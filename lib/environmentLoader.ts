import fs from 'fs';
import path from 'path';

interface EnvironmentConfig {
  apiKey: string;
  baseId: string;
  accountEmail?: string;
}

export class EnvironmentLoader {
  private static loadEnvFile(filePath: string): Record<string, string> {
    try {
      // console.log(`🔍 Attempting to load environment file: ${filePath}`);
      // console.log(`🔍 Current working directory: ${process.cwd()}`);
      // console.log(`🔍 File exists: ${fs.existsSync(filePath)}`);
      
      if (!fs.existsSync(filePath)) {
        // console.log(`📁 Environment file not found: ${filePath}`);
        return {};
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const envVars: Record<string, string> = {};

      content.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalIndex = trimmedLine.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmedLine.substring(0, equalIndex);
            const value = trimmedLine.substring(equalIndex + 1);
            envVars[key] = value;
          }
        }
      });

      // console.log(`📁 Loaded ${Object.keys(envVars).length} variables from ${filePath}`);
      return envVars;
    } catch (error) {
      // During build time or production, file system access might be restricted
      // Don't log errors for missing .env.virtual.local as it's expected in production
      if (!filePath.includes('.env.virtual.local')) {
        console.error(`❌ Error loading environment file ${filePath}:`, error);
      }
      return {};
    }
  }

  static getRegularEnvironment(): EnvironmentConfig {
    // console.log('🔍 Loading REGULAR environment...');
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envVars = this.loadEnvFile(envPath);

    // Fallback to process.env if file doesn't exist (production environment)
    const config = {
      apiKey: envVars.NEXT_PUBLIC_AIRTABLE_API_KEY || process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || '',
      baseId: envVars.NEXT_PUBLIC_AIRTABLE_BASE_ID || process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || '',
      accountEmail: envVars.AIRTABLE_ACCOUNT_EMAIL || process.env.AIRTABLE_ACCOUNT_EMAIL || ''
    };
    
    // console.log('🔍 Regular environment config:', {
    //   apiKeyExists: !!config.apiKey,
    //   baseId: config.baseId,
    //   accountEmail: config.accountEmail,
    //   apiKeyFromFile: !!envVars.NEXT_PUBLIC_AIRTABLE_API_KEY,
    //   apiKeyFromEnv: !!process.env.NEXT_PUBLIC_AIRTABLE_API_KEY,
    //   baseIdFromFile: !!envVars.NEXT_PUBLIC_AIRTABLE_BASE_ID,
    //   baseIdFromEnv: !!process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID
    // });
    
    return config;
  }

  static getVirtualEnvironment(): EnvironmentConfig {
    console.log('🔍 Loading VIRTUAL environment...');
    const envPath = path.resolve(process.cwd(), '.env.virtual.local');
    const envVars = this.loadEnvFile(envPath);

    // Fallback to process.env if file doesn't exist (production environment)
    const config = {
      apiKey: envVars.VIRTUAL_AIRTABLE_API_KEY || process.env.VIRTUAL_AIRTABLE_API_KEY || '',
      baseId: envVars.VIRTUAL_AIRTABLE_BASE_ID || process.env.VIRTUAL_AIRTABLE_BASE_ID || '',
      accountEmail: envVars.VIRTUAL_AIRTABLE_ACCOUNT_EMAIL || process.env.VIRTUAL_AIRTABLE_ACCOUNT_EMAIL || ''
    };
    
    console.log('🔍 Virtual environment config:', {
      apiKeyExists: !!config.apiKey,
      baseId: config.baseId,
      accountEmail: config.accountEmail,
      apiKeyFromFile: !!envVars.VIRTUAL_AIRTABLE_API_KEY,
      apiKeyFromEnv: !!process.env.VIRTUAL_AIRTABLE_API_KEY,
      baseIdFromFile: !!envVars.VIRTUAL_AIRTABLE_BASE_ID,
      baseIdFromEnv: !!process.env.VIRTUAL_AIRTABLE_BASE_ID
    });
    
    return config;
  }

  static getEnvironmentConfig(environment: 'regular' | 'virtual'): EnvironmentConfig {
    // console.log(`🔍 Getting environment config for: ${environment}`);
    if (environment === 'virtual') {
      return this.getVirtualEnvironment();
    } else {
      return this.getRegularEnvironment();
    }
  }
} 