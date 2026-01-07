/**
 * 凭证存储模块
 * 使用系统 Keychain 或加密文件存储敏感凭证
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SSHError, SSHErrorCode, MCPServerConfig, DEFAULT_CONFIG } from '../types/index.js';
import { expandHome } from '../utils/index.js';

// keytar 类型
type KeytarModule = typeof import('keytar');

// keytar 延迟加载（某些环境可能不可用）
let keytarModule: KeytarModule | null = null;
let keytarLoaded = false;

async function getKeytar(): Promise<KeytarModule | null> {
  if (keytarLoaded) {
    return keytarModule;
  }
  keytarLoaded = true;
  try {
    keytarModule = await import('keytar');
    return keytarModule;
  } catch {
    // keytar 不可用，使用文件存储
    return null;
  }
}

const SERVICE_NAME = 'ssh-mcp-server';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * 凭证类型
 */
export interface Credential {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

/**
 * 凭证存储器
 */
export class CredentialStore {
  private config: MCPServerConfig;
  private encryptionKey?: Buffer;
  private credentialsFilePath: string;

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.credentialsFilePath = path.join(
      expandHome(this.config.dataDir),
      'credentials.enc'
    );
  }

  /**
   * 初始化（设置主密码）
   */
  async initialize(masterPassword?: string): Promise<void> {
    if (masterPassword) {
      // 从主密码派生加密密钥
      this.encryptionKey = crypto.scryptSync(masterPassword, SERVICE_NAME, 32);
    }

    // 确保数据目录存在
    const dataDir = expandHome(this.config.dataDir);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * 保存凭证
   */
  async save(alias: string, credential: Credential): Promise<void> {
    // 优先使用 keytar
    const keytar = await getKeytar();
    if (keytar) {
      try {
        const value = JSON.stringify(credential);
        await keytar.setPassword(SERVICE_NAME, alias, value);
        return;
      } catch {
        // keytar 失败，回退到文件存储
      }
    }

    // 使用加密文件存储
    await this.saveToFile(alias, credential);
  }

  /**
   * 读取凭证
   */
  async get(alias: string): Promise<Credential | null> {
    // 优先使用 keytar
    const keytar = await getKeytar();
    if (keytar) {
      try {
        const value = await keytar.getPassword(SERVICE_NAME, alias);
        if (value) {
          return JSON.parse(value) as Credential;
        }
      } catch {
        // keytar 失败，回退到文件存储
      }
    }

    // 使用加密文件存储
    return this.getFromFile(alias);
  }

  /**
   * 删除凭证
   */
  async delete(alias: string): Promise<void> {
    // 优先使用 keytar
    const keytar = await getKeytar();
    if (keytar) {
      try {
        await keytar.deletePassword(SERVICE_NAME, alias);
      } catch {
        // 忽略错误
      }
    }

    // 同时从文件存储删除
    await this.deleteFromFile(alias);
  }

  /**
   * 列出所有凭证的别名
   */
  async list(): Promise<string[]> {
    const aliases: string[] = [];

    // 从 keytar 获取
    const keytar = await getKeytar();
    if (keytar) {
      try {
        const credentials = await keytar.findCredentials(SERVICE_NAME);
        aliases.push(...credentials.map((c) => c.account));
      } catch {
        // 忽略错误
      }
    }

    // 从文件获取
    const fileAliases = await this.listFromFile();
    for (const alias of fileAliases) {
      if (!aliases.includes(alias)) {
        aliases.push(alias);
      }
    }

    return aliases;
  }

  // ============ 加密文件存储方法 ============

  /**
   * 保存到加密文件
   */
  private async saveToFile(alias: string, credential: Credential): Promise<void> {
    if (!this.encryptionKey) {
      throw new SSHError(
        SSHErrorCode.CREDENTIAL_ERROR,
        '未设置主密码，无法使用文件存储'
      );
    }

    const data = await this.readEncryptedFile();
    data[alias] = credential;
    await this.writeEncryptedFile(data);
  }

  /**
   * 从加密文件读取
   */
  private async getFromFile(alias: string): Promise<Credential | null> {
    if (!this.encryptionKey) {
      return null;
    }

    const data = await this.readEncryptedFile();
    return data[alias] ?? null;
  }

  /**
   * 从加密文件删除
   */
  private async deleteFromFile(alias: string): Promise<void> {
    if (!this.encryptionKey) {
      return;
    }

    const data = await this.readEncryptedFile();
    delete data[alias];
    await this.writeEncryptedFile(data);
  }

  /**
   * 列出文件中的所有别名
   */
  private async listFromFile(): Promise<string[]> {
    if (!this.encryptionKey) {
      return [];
    }

    const data = await this.readEncryptedFile();
    return Object.keys(data);
  }

  /**
   * 读取加密文件
   */
  private async readEncryptedFile(): Promise<Record<string, Credential>> {
    if (!fs.existsSync(this.credentialsFilePath)) {
      return {};
    }

    try {
      const encryptedData = fs.readFileSync(this.credentialsFilePath);
      const decrypted = this.decrypt(encryptedData);
      return JSON.parse(decrypted) as Record<string, Credential>;
    } catch {
      // 文件损坏或密钥错误
      return {};
    }
  }

  /**
   * 写入加密文件
   */
  private async writeEncryptedFile(data: Record<string, Credential>): Promise<void> {
    const json = JSON.stringify(data);
    const encrypted = this.encrypt(json);
    fs.writeFileSync(this.credentialsFilePath, encrypted, { mode: 0o600 });
  }

  /**
   * 加密数据
   */
  private encrypt(plaintext: string): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey!, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // 格式: iv (16) + authTag (16) + encrypted
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * 解密数据
   */
  private decrypt(data: Buffer): string {
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey!, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
