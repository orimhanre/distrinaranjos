import Airtable from 'airtable';
import { EnvironmentLoader } from './environmentLoader';

// Airtable configuration - Support both regular and virtual environments
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Products';

// Debug logging for initial load
console.log('🔍 Airtable Configuration Initial Load:');
console.log('  - Table Name:', AIRTABLE_TABLE_NAME);

export interface AirtableProduct {
  id: string;
  fields: {
    Name?: string;
    Brand?: string;
    Type?: string;
    Category?: string;
    Colors?: string[];
    Price1?: number;
    Price2?: number;
    IsProductStarred?: boolean;
    Quantity?: number;
    Materials?: string;
    Dimensions?: string;
    Capacity?: string;
    ImageURL?: string[];
  
    [key: string]: any; // Allow any additional fields
  };
}

export interface AirtableWebPhoto {
  id: string;
  fields: {
    Name?: string;
    ImageURL?: string;
    URL?: string;
    Image?: string;
    Photo?: string;
    [key: string]: any; // Allow any additional fields
  };
}

export interface SyncResult {
  success: boolean;
  message: string;
  syncedCount: number;
  errors: string[];
}

export class AirtableService {
  private static currentEnvironment: 'virtual' | 'regular' = 'virtual';
  
  /**
   * Switch between virtual and regular Airtable environments
   */
  static switchEnvironment(environment: 'virtual' | 'regular') {
    this.currentEnvironment = environment;
    console.log(`🔄 Switched to ${environment.toUpperCase()} Airtable environment`);
  }
  
  /**
   * Get current environment
   */
  static getCurrentEnvironment() {
    return this.currentEnvironment;
  }
  
  /**
   * Determine environment based on request context
   * - distri1 & naranjos2: Use REGULAR environment
   * - Main page (marcas/tipo/categoria): Use VIRTUAL environment
   */
  static determineEnvironmentFromContext(context?: string): 'virtual' | 'regular' {
    if (context === 'distri1' || context === 'naranjos2' || context === 'regular') {
      return 'regular';
    }
    // Default to virtual for main page and other contexts
    return 'virtual';
  }
  
  /**
   * Switch environment based on context
   */
  static switchEnvironmentFromContext(context?: string) {
    const environment = this.determineEnvironmentFromContext(context);
    console.log(`🔄 Switching environment from context: ${context} -> ${environment}`);
    this.switchEnvironment(environment);
    
    // Verify the switch worked
    const currentEnv = this.getCurrentEnvironment();
    if (currentEnv !== environment) {
      console.error(`❌ Environment switch failed! Expected: ${environment}, Got: ${currentEnv}`);
    } else {
      console.log(`✅ Environment switch successful: ${currentEnv}`);
    }
  }
  
  /**
   * Get the appropriate API key and base ID for current environment
   */
  private static getCurrentConfig() {
    const config = EnvironmentLoader.getEnvironmentConfig(this.currentEnvironment);
    
    console.log(`🔍 Airtable Configuration for ${this.currentEnvironment.toUpperCase()} environment:`);
    console.log('  - API Key exists:', !!config.apiKey);
    console.log('  - Base ID:', config.baseId);
    console.log('  - Account Email:', config.accountEmail);
    console.log('  - API Key (first 10 chars):', config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'NOT SET');
    console.log('  - Base ID (first 10 chars):', config.baseId ? config.baseId.substring(0, 10) + '...' : 'NOT SET');
    
    return {
      apiKey: config.apiKey,
      baseId: config.baseId
    };
  }
  
  /**
   * Fetch all records from Airtable
   */
  static async fetchAllRecords(): Promise<AirtableProduct[]> {
    const config = this.getCurrentConfig();
    
    if (!config.apiKey || !config.baseId) {
      throw new Error(`Airtable API key or Base ID not configured for ${this.currentEnvironment} environment`);
    }

    console.log(`🔍 Fetching products from Airtable base: ${config.baseId}`);
    console.log(`🔍 Using table: ${AIRTABLE_TABLE_NAME}`);
    console.log(`🔍 Using API key: ${config.apiKey ? 'Configured' : 'Missing'}`);

    const records: AirtableProduct[] = [];
    
    return new Promise((resolve, reject) => {
      const currentBase = new Airtable({ apiKey: config.apiKey }).base(config.baseId);
      
      console.log('🔍 Querying products table...');
      
      currentBase(AIRTABLE_TABLE_NAME).select({
        view: 'Grid view'
      }).eachPage((pageRecords, fetchNextPage) => {
        console.log(`📄 Processing page with ${pageRecords.length} product records`);
        pageRecords.forEach(record => {
          console.log(`🔍 Product record ${record.id}:`, JSON.stringify(record.fields, null, 2));
          records.push({
            id: record.id,
            fields: record.fields
          });
        });
        fetchNextPage();
      }, (err) => {
        if (err) {
          console.error('❌ Error fetching products:', err);
          reject(err);
        } else {
          console.log(`✅ Successfully fetched ${records.length} product records`);
          resolve(records);
        }
      });
    });
  }

  /**
   * Convert Airtable record to local product format - FULLY DYNAMIC VERSION
   */
  static convertAirtableToProduct(airtableRecord: AirtableProduct) {
    const fields = airtableRecord.fields;
    
    // Reduced logging - only log if debugging is enabled
    if (process.env.DEBUG_AIRTABLE_CONVERSION === 'true') {
      console.log(`🔍 Converting Airtable record ${airtableRecord.id} in ${this.currentEnvironment} environment`);
      console.log(`🔍 Available fields:`, Object.keys(fields));
      console.log(`🔍 Stock/Quantity fields check:`, {
        hasStock: !!fields.Stock,
        hasQuantity: !!fields.Quantity,
        hasstock: !!fields.stock,
        hasquantity: !!fields.quantity,
        stockValue: fields.Stock || fields.stock,
        quantityValue: fields.Quantity || fields.quantity
      });
    }
    

    
    // Helper function to extract attachment objects (preserving original filenames)
    const extractImageAttachments = (value: any): any[] => {
      // Reduced logging - only log if debugging is enabled
      if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
        console.log(`🔍 extractImageAttachments called with:`, {
          value,
          type: typeof value,
          isArray: Array.isArray(value),
          length: Array.isArray(value) ? value.length : 'N/A'
        });
      }
      
      if (!value) {
        if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
          console.log(`🔍 extractImageAttachments: No value, returning empty array`);
        }
        return [];
      }
      
      if (typeof value === 'string') {
        if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
          console.log(`🔍 extractImageAttachments: String value, returning:`, [value]);
        }
        return [value];
      }
      
      if (Array.isArray(value)) {
        if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
          console.log(`🔍 extractImageAttachments: Array value, processing ${value.length} items`);
        }
        // Handle array of attachments - preserve original attachment objects
        const attachments = value
          .map(attachment => {
            if (typeof attachment === 'object' && attachment.url) {
              if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
                console.log(`🔍 extractImageAttachments: Found attachment object with filename:`, attachment.filename);
              }
              return attachment;
            }
            if (typeof attachment === 'string') {
              if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
                console.log(`🔍 extractImageAttachments: Found string attachment:`, attachment);
              }
              return attachment;
            }
            if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
              console.log(`🔍 extractImageAttachments: Skipping invalid attachment:`, attachment);
            }
            return null;
          })
          .filter(attachment => attachment !== null);
        if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
          console.log(`🔍 extractImageAttachments: Extracted ${attachments.length} attachments from array`);
        }
        return attachments;
      }
      
      if (typeof value === 'object' && value.url) {
        if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
          console.log(`🔍 extractImageAttachments: Single attachment object with filename:`, value.filename);
        }
        return [value];
      }
      
      if (process.env.DEBUG_AIRTABLE_ATTACHMENTS === 'true') {
        console.log(`🔍 extractImageAttachments: No valid attachments found, returning empty array`);
      }
      return [];
    };
    
    // Helper function to safely convert values for SQLite
    const safeValue = (value: any, fieldName?: string): any => {
      try {
        if (value === null || value === undefined) {
          return null;
        }
        
        // Special handling for SKU field - always ensure it's a string
        if (fieldName && fieldName.toUpperCase() === 'SKU') {
          return String(value);
        }
        
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'object') {
          // Special handling for image attachments - convert to URL arrays
          if (fieldName) {
            const fieldNameLower = fieldName.toLowerCase();
            const isImageField = fieldNameLower.includes('image') || 
                fieldNameLower.includes('photo') || 
                fieldNameLower.includes('attachment') ||
                fieldNameLower.includes('url') ||
                fieldNameLower === 'imageurl' ||
                fieldNameLower === 'image_url' ||
                fieldNameLower === 'imageurls' ||
                fieldNameLower === 'photos' ||
                fieldNameLower === 'images';
            
            if (isImageField) {
              console.log(`🔍 Processing image field: ${fieldName} with value:`, value);
              console.log(`🔍 Field type: ${typeof value}, isArray: ${Array.isArray(value)}`);
              const attachments = extractImageAttachments(value);
              console.log(`🔍 Extracted ${attachments.length} attachments from ${fieldName}:`, attachments);
              // Always return an array for image fields, even if empty
              return attachments;
            }
          }
          
          // For non-image objects, stringify them
          return JSON.stringify(value);
        }
        
        if (Array.isArray(value)) {
          // For multi-select fields, keep as array for proper handling
          return value;
        }
        // Convert any other type to string
        return String(value);
      } catch (error) {
        console.error('Error converting value:', value, error);
        return null;
      }
    };

    // Convert ALL fields from Airtable dynamically
    const product: any = {
      id: airtableRecord.id,
      lastUpdated: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Process ALL fields from Airtable with original case
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      // Preserve original case from Airtable
      // Reduced logging - only log if debugging is enabled
      if (process.env.DEBUG_AIRTABLE_FIELDS === 'true') {
        console.log(`🔍 Processing field: ${fieldName} (type: ${typeof fieldValue})`);
      }
      const processedValue = safeValue(fieldValue, fieldName);
      product[fieldName] = processedValue;
    }
    
    // For virtual environment, if no images are found, use placeholder images
    if (this.currentEnvironment === 'virtual' && (!product.imageURL || product.imageURL.length === 0)) {
      // Only log this once per product, not for every field
      if (process.env.DEBUG_AIRTABLE_IMAGES === 'true') {
        console.log(`🖼️ Virtual environment: No images found for product ${product.id}, using placeholder`);
      }
      product.imageURL = ['/placeholder-product.svg'];
    } else if (this.currentEnvironment === 'virtual' && product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
      // Log when images are found
      if (process.env.DEBUG_AIRTABLE_IMAGES === 'true') {
        console.log(`🖼️ Virtual environment: Found ${product.imageURL.length} images for product ${product.id}:`, product.imageURL);
      }
    }
    


    // Handle price field mapping for database compatibility
    // Reduced logging - only log if debugging is enabled
    if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
      console.log(`🔍 Processing product ${product.id}: price=${product.price}, price1=${product.price1}, price2=${product.price2}`);
      console.log(`🔍 Current environment: ${this.currentEnvironment}`);
    }
    
    // Only apply price mapping for REGULAR environment (not virtual)
    if (this.currentEnvironment === 'regular') {
      if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
        console.log(`🔍 Regular environment detected - applying price1/price2 mapping`);
      }
      
      // For regular environment, use separate Price1 and Price2 fields from Airtable
      // If Price1 exists, use it for price1
      if (product.Price1 !== undefined && product.Price1 !== null) {
        product.price1 = product.Price1;
        if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
          console.log(`💰 Using Price1 from Airtable: ${product.Price1} -> price1: ${product.price1}`);
        }
      }
      
      // If Price2 exists, use it for price2
      if (product.Price2 !== undefined && product.Price2 !== null) {
        product.price2 = product.Price2;
        if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
          console.log(`💰 Using Price2 from Airtable: ${product.Price2} -> price2: ${product.price2}`);
        }
      }
      
      // If only one price field exists, use it for both
      if ((product.price1 === undefined || product.price1 === null) && (product.price2 !== undefined && product.price2 !== null)) {
        product.price1 = product.price2;
        if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
          console.log(`💰 Only Price2 exists, using for both: ${product.price2} -> price1: ${product.price1}`);
        }
      } else if ((product.price2 === undefined || product.price2 === null) && (product.price1 !== undefined && product.price1 !== null)) {
        product.price2 = product.price1;
        if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
          console.log(`💰 Only Price1 exists, using for both: ${product.price1} -> price2: ${product.price2}`);
        }
      }
      
      // Fallback to 'price' field if neither Price1 nor Price2 exists
      if ((product.price1 === undefined || product.price1 === null) && (product.price2 === undefined || product.price2 === null)) {
        if (product.price !== undefined && product.price !== null) {
          product.price1 = product.price;
          product.price2 = product.price;
          if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
            console.log(`💰 Fallback to price field: ${product.price} -> price1: ${product.price1}, price2: ${product.price2}`);
          }
        } else {
          // Set default values if no price fields are found
          product.price1 = 0;
          product.price2 = 0;
          if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
            console.log(`⚠️ No price fields found, setting defaults: price1: 0, price2: 0`);
          }
        }
      }
      
      // Clean up the original Price1/Price2 fields to avoid confusion
      delete product.Price1;
      delete product.Price2;
      
    } else {
      // Virtual environment - keep original price field, don't modify price1/price2
      if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
        console.log(`🔍 Virtual environment detected - keeping original price field`);
      }
      if (!product.price) {
        product.price = 0;
        if (process.env.DEBUG_AIRTABLE_PRICES === 'true') {
          console.log(`⚠️ No price field found in virtual environment, setting default: price: 0`);
        }
      }
    }

    // Handle quantity/stock field mapping for different environments
    if (process.env.DEBUG_AIRTABLE_STOCK === 'true') {
      console.log(`🔍 Processing quantity/stock: quantity=${product.quantity}, stock=${product.stock}`);
    }
    
    if (this.currentEnvironment === 'regular') {
      // Regular environment - use 'quantity' field, fallback to 'stock' if needed
      if (product.quantity === undefined || product.quantity === null) {
        if (product.stock !== undefined && product.stock !== null) {
          product.quantity = product.stock;
          console.log(`📦 Regular environment: mapped stock field: ${product.stock} -> quantity: ${product.quantity}`);
        } else {
          product.quantity = 0;
          console.log(`⚠️ Regular environment: no quantity or stock field found, setting default: quantity: 0`);
        }
      }
    } else {
      // Virtual environment - use 'stock' field only
      // Check for various possible field names from Airtable
      const possibleStockFields = ['Stock', 'stock', 'Quantity', 'quantity', 'Qty', 'qty'];
      let stockValue = null;
      
      for (const fieldName of possibleStockFields) {
        if (fields[fieldName] !== undefined && fields[fieldName] !== null) {
          stockValue = fields[fieldName];
          console.log(`📦 Virtual environment: found stock value in field '${fieldName}': ${stockValue}`);
          break;
        }
      }
      
      if (stockValue !== null) {
        product.stock = parseInt(String(stockValue)) || 0;
        console.log(`📦 Virtual environment: set stock to ${product.stock}`);
      } else {
        product.stock = 0;
        console.log(`⚠️ Virtual environment: no stock field found, setting default: stock: 0`);
      }
      
      // Remove quantity field for virtual environment - use stock only
      delete product.quantity;
      console.log(`📦 Virtual environment: using stock field only: ${product.stock}`);
    }

    // Ensure required fields have default values
    if (!product.name || product.name === '') {
      product.name = 'Sin Nombre';
      console.log(`⚠️ No name field found, setting default: ${product.name}`);
    }
    
    if (!product.brand || product.brand === '') {
      product.brand = 'Sin Marca';
      console.log(`⚠️ No brand field found, setting default: ${product.brand}`);
    }

    console.log(`✅ Final converted product:`, {
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      imageURL: product.imageURL
    });

    return product;
  }

  /**
   * Test Airtable connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const config = this.getCurrentConfig();
      console.log(`Testing Airtable connection for ${this.currentEnvironment} environment...`);
      console.log('API Key exists:', !!config.apiKey);
      console.log('Base ID exists:', !!config.baseId);
      console.log('Table Name:', AIRTABLE_TABLE_NAME);
      
      if (!config.apiKey || !config.baseId) {
        console.log(`Missing Airtable credentials for ${this.currentEnvironment} environment`);
        return false;
      }

      const records = await this.fetchAllRecords();
      console.log('Successfully fetched records:', records.length);
      return records.length >= 0; // If we can fetch records, connection is working
    } catch (error) {
      console.error('Airtable connection test failed:', error);
      return false;
    }
  }

  /**
   * Get Airtable table schema (field names) - Enhanced version that gets ALL fields including empty ones
   */
  static async getTableSchema(): Promise<string[]> {
    try {
      const config = this.getCurrentConfig();
      
      if (!config.apiKey || !config.baseId) {
        throw new Error(`Airtable API key or Base ID not configured for ${this.currentEnvironment} environment`);
      }

      // Try to get complete table schema using Airtable's metadata API
      try {
        console.log(`📋 Attempting to get complete table schema from Airtable metadata...`);
        
        const currentBase = new Airtable({ apiKey: config.apiKey }).base(config.baseId);
        const table = currentBase(AIRTABLE_TABLE_NAME);
        
        // Use Airtable's metadata API to get all fields
        const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${config.baseId}/tables`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          console.log(`📋 Metadata response:`, metadata);
          
          // Find the Products table
          const productsTable = metadata.tables?.find((table: any) => 
            table.name === AIRTABLE_TABLE_NAME || 
            table.name.toLowerCase().includes('product')
          );
          
          if (productsTable) {
            const allFields = productsTable.fields?.map((field: any) => field.name) || [];
            console.log(`📋 Found ${allFields.length} fields from metadata:`, allFields);
            
            // Check for subCategory specifically
            const subCategoryFields = allFields.filter((field: string) => 
              field.toLowerCase().includes('sub') || 
              field.toLowerCase().includes('category') ||
              field.toLowerCase().includes('subcategory')
            );
            
            if (subCategoryFields.length > 0) {
              console.log(`📋 Found potential subCategory fields in metadata:`, subCategoryFields);
            }
            
            return allFields;
          }
        }
      } catch (metadataError) {
        console.log(`📋 Could not get complete schema from metadata API:`, metadataError);
      }

      // Fallback: Get fields from actual records (original method)
      console.log(`📋 Falling back to record-based field detection...`);
      const records = await this.fetchAllRecords();
      console.log(`📋 Fetched ${records.length} records from ${this.currentEnvironment} environment`);
      
      if (records.length === 0) {
        return [];
      }

      // Get all unique field names from all records
      const allFieldNames = new Set<string>();
      
      // Log first few records in detail to debug
      const sampleRecords = records.slice(0, 3);
      sampleRecords.forEach((record, index) => {
        const recordFields = Object.keys(record.fields);
        console.log(`📋 Record ${index + 1} (ID: ${record.id}) fields:`, recordFields);
        console.log(`📋 Record ${index + 1} field values:`, Object.entries(record.fields).map(([key, value]) => `${key}: ${value}`));
        
        // Check for subCategory or similar fields
        const subCategoryFields = recordFields.filter(field => 
          field.toLowerCase().includes('sub') || 
          field.toLowerCase().includes('category') ||
          field.toLowerCase().includes('subcategory')
        );
        if (subCategoryFields.length > 0) {
          console.log(`📋 Found potential subCategory fields in record ${index + 1}:`, subCategoryFields);
        }
        
        recordFields.forEach(fieldName => {
          allFieldNames.add(fieldName);
        });
      });
      
      // Process all records for schema
      records.forEach((record, index) => {
        const recordFields = Object.keys(record.fields);
        recordFields.forEach(fieldName => {
          allFieldNames.add(fieldName);
        });
      });

      const schema = Array.from(allFieldNames);
      console.log(`📋 Found ${schema.length} unique fields in ${this.currentEnvironment} Airtable:`, schema);
      return schema;
    } catch (error) {
      console.error('Failed to get Airtable schema:', error);
      return [];
    }
  }

  /**
   * Get Airtable table schema with field types - Enhanced version that gets field names AND types
   */
  static async getTableSchemaWithTypes(): Promise<Array<{ key: string; label: string; type: string }>> {
    try {
      const config = this.getCurrentConfig();
      
      if (!config.apiKey || !config.baseId) {
        throw new Error(`Airtable API key or Base ID not configured for ${this.currentEnvironment} environment`);
      }

      // Try to get complete table schema using Airtable's metadata API
      try {
        console.log(`📋 Attempting to get complete table schema with types from Airtable metadata...`);
        
        const currentBase = new Airtable({ apiKey: config.apiKey }).base(config.baseId);
        const table = currentBase(AIRTABLE_TABLE_NAME);
        
        // Use Airtable's metadata API to get all fields with types
        const metadataResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${config.baseId}/tables`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          console.log(`📋 Metadata response with types:`, metadata);
          
          // Find the Products table
          const productsTable = metadata.tables?.find((table: any) => 
            table.name === AIRTABLE_TABLE_NAME || 
            table.name.toLowerCase().includes('product')
          );
          
          if (productsTable && productsTable.fields) {
            const fieldsWithTypes = productsTable.fields.map((field: any) => {
              // Map Airtable field types to our internal types
              let mappedType = 'text'; // default
              
              if (field.type === 'singleLineText') {
                mappedType = 'text';
              } else if (field.type === 'multilineText') {
                mappedType = 'longText';
              } else if (field.type === 'number') {
                mappedType = 'number';
              } else if (field.type === 'checkbox') {
                mappedType = 'boolean';
              } else if (field.type === 'singleSelect') {
                mappedType = 'select';
              } else if (field.type === 'multipleSelects') {
                mappedType = 'multipleSelect';
              } else if (field.type === 'multipleAttachments') {
                mappedType = 'attachment';
              } else if (field.type === 'email') {
                mappedType = 'email';
              } else if (field.type === 'phoneNumber') {
                mappedType = 'phone';
              } else if (field.type === 'date') {
                mappedType = 'date';
              } else if (field.type === 'createdTime') {
                mappedType = 'createdTime';
              } else if (field.type === 'lastModifiedTime') {
                mappedType = 'lastModifiedTime';
              }
              
              return {
                key: field.name,
                label: field.name,
                type: mappedType
              };
            });
            
            console.log(`📋 Found ${fieldsWithTypes.length} fields with types from metadata:`, fieldsWithTypes);
            return fieldsWithTypes;
          }
        }
      } catch (metadataError) {
        console.log(`📋 Could not get complete schema with types from metadata API:`, metadataError);
      }

      // Fallback: Get fields from actual records and infer types
      console.log(`📋 Falling back to record-based field detection with type inference...`);
      const records = await this.fetchAllRecords();
      console.log(`📋 Fetched ${records.length} records from ${this.currentEnvironment} environment`);
      
      if (records.length === 0) {
        return [];
      }

      // Get all unique field names and infer types from values
      const fieldMap = new Map<string, { key: string; label: string; type: string }>();
      
      records.forEach((record, index) => {
        Object.entries(record.fields).forEach(([fieldName, fieldValue]) => {
          if (!fieldMap.has(fieldName)) {
            // Infer type from the first non-null value
            let inferredType = 'text';
            
            if (typeof fieldValue === 'number') {
              inferredType = 'number';
            } else if (typeof fieldValue === 'boolean') {
              inferredType = 'boolean';
            } else if (Array.isArray(fieldValue)) {
              if (fieldValue.length > 0 && typeof fieldValue[0] === 'string' && fieldValue[0].startsWith('http')) {
                inferredType = 'attachment';
              } else {
                inferredType = 'multipleSelect';
              }
            } else if (typeof fieldValue === 'string') {
              // Check for specific field types based on name
              if (fieldName.toLowerCase().includes('email')) {
                inferredType = 'email';
              } else if (fieldName.toLowerCase().includes('phone')) {
                inferredType = 'phone';
              } else if (fieldName.toLowerCase().includes('date')) {
                inferredType = 'date';
              } else if (fieldName.toLowerCase().includes('detail') || fieldName.toLowerCase().includes('description')) {
                inferredType = 'longText';
              } else if (fieldValue.length > 100) {
                inferredType = 'longText';
              } else {
                inferredType = 'text';
              }
            }
            
            fieldMap.set(fieldName, {
              key: fieldName,
              label: fieldName,
              type: inferredType
            });
          }
        });
      });
      
      const fieldsWithTypes = Array.from(fieldMap.values());
      console.log(`📋 Inferred ${fieldsWithTypes.length} fields with types:`, fieldsWithTypes);
      return fieldsWithTypes;
    } catch (error) {
      console.error('Error getting table schema with types:', error);
      return [];
    }
  }

  /**
   * Fetch all WebPhotos records from Airtable
   */
  static async fetchAllWebPhotosRecords(): Promise<AirtableWebPhoto[]> {
    const config = this.getCurrentConfig();
    
    if (!config.apiKey || !config.baseId) {
      throw new Error(`Airtable API key or Base ID not configured for ${this.currentEnvironment} environment`);
    }

    console.log(`🔍 Fetching WebPhotos from Airtable base: ${config.baseId}`);
    console.log(`🔍 Using API key: ${config.apiKey ? 'Configured' : 'Missing'}`);

    const records: AirtableWebPhoto[] = [];
    
    return new Promise((resolve, reject) => {
      const currentBase = new Airtable({ apiKey: config.apiKey }).base(config.baseId);
      
      console.log('🔍 Querying WebPhotos table...');
      
      currentBase('WebPhotos').select({
        view: 'Grid view'
      }).eachPage((pageRecords, fetchNextPage) => {
        console.log(`📄 Processing page with ${pageRecords.length} records`);
        pageRecords.forEach(record => {
          console.log(`🔍 WebPhoto record ${record.id}:`, JSON.stringify(record.fields, null, 2));
          records.push({
            id: record.id,
            fields: record.fields
          });
        });
        fetchNextPage();
      }, (err) => {
        if (err) {
          console.error('❌ Error fetching WebPhotos:', err);
          reject(err);
        } else {
          console.log(`✅ Successfully fetched ${records.length} WebPhoto records`);
          resolve(records);
        }
      });
    });
  }

  /**
   * Convert Airtable WebPhoto record to local format
   */
  static convertAirtableToWebPhoto(airtableRecord: AirtableWebPhoto) {
    const fields = airtableRecord.fields;
    
    // Debug logging to see the actual field structure
    console.log('🔍 Airtable WebPhoto fields:', JSON.stringify(fields, null, 2));
    
    // Helper function to extract URL and filename from Airtable attachment object
    const extractUrlAndFilename = (value: any): { url: string; filename: string } => {
      console.log('🔍 extractUrlAndFilename called with:', {
        value,
        type: typeof value,
        isArray: Array.isArray(value),
        hasUrl: typeof value === 'object' && value.url,
        keys: typeof value === 'object' ? Object.keys(value) : 'N/A'
      });
      
      if (typeof value === 'string') {
        console.log('🔍 String value detected, returning as URL');
        return { url: value, filename: '' };
      }
      
      if (Array.isArray(value) && value.length > 0) {
        console.log(`🔍 Array value detected with ${value.length} items`);
        // Handle array of attachments
        const firstAttachment = value[0];
        console.log('🔍 First attachment:', firstAttachment);
        if (typeof firstAttachment === 'object' && firstAttachment.url) {
          console.log('✅ Found attachment object with URL:', firstAttachment.url);
          return { 
            url: firstAttachment.url, 
            filename: firstAttachment.filename || '' 
          };
        }
      }
      
      if (typeof value === 'object' && value.url) {
        console.log('✅ Found single attachment object with URL:', value.url);
        return { 
          url: value.url, 
          filename: value.filename || '' 
        };
      }
      
      console.log('⚠️ No valid attachment found in value');
      return { url: '', filename: '' };
    };
    
    // Try different possible field names for image URL with better error handling
    let imageUrl = '';
    let originalFilename = '';
    try {
      // Check all possible field names for image URL
      const possibleImageFields = [
        fields.image, 
        fields.imageURL, 
        fields.ImageURL, 
        fields.URL, 
        fields.Image, 
        fields.Photo,
        fields.photo,
        fields.PhotoURL,
        fields.photoURL
      ];
      
      console.log('🔍 Checking possible image fields:', possibleImageFields);
      
      for (const field of possibleImageFields) {
        if (field) {
          const result = extractUrlAndFilename(field);
          if (result.url) {
            imageUrl = result.url;
            originalFilename = result.filename;
            console.log('✅ Found image URL in field:', field);
            console.log('🔍 Extracted imageUrl:', imageUrl);
            console.log('🔍 Extracted originalFilename:', originalFilename);
            break;
          }
        }
      }
      
      if (!imageUrl) {
        console.warn('⚠️ No valid image URL found in any field');
        console.log('🔍 All fields checked:', fields);
      }
    } catch (error) {
      console.error('❌ Error extracting imageUrl:', error);
      imageUrl = '';
      originalFilename = '';
    }
    
    // Normalize the name to use underscores instead of hyphens for consistency
    let rawName = '';
    try {
      rawName = fields.name || fields.Name || '';
      console.log('🔍 Raw name from fields:', rawName);
    } catch (error) {
      console.error('❌ Error extracting name:', error);
      rawName = '';
    }
    
    const normalizedName = rawName.replace(/-/g, '_');
    console.log('🔍 Normalized name:', normalizedName);
    
    return {
      id: airtableRecord.id,
      name: normalizedName,
      imageUrl: imageUrl,
      originalFilename: originalFilename,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Fetch all WebPhotos from Airtable and return as a map
   */
  static async fetchWebPhotos(): Promise<Record<string, string>> {
    try {
      const records = await this.fetchAllWebPhotosRecords();
      const webPhotos: Record<string, string> = {};
      
      records.forEach(record => {
        const webPhoto = this.convertAirtableToWebPhoto(record);
        if (webPhoto.name && webPhoto.imageUrl) {
          webPhotos[webPhoto.name] = webPhoto.imageUrl;
        }
      });
      
      return webPhotos;
    } catch (error) {
      console.error('Error fetching WebPhotos from Airtable:', error);
      return {};
    }
  }
}