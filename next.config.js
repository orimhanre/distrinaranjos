const { loadEnvConfig } = require('@next/env')
const path = require('path')

// Load environment variables from .env.virtual.local
try {
  const fs = require('fs')
  const envVirtualPath = path.join(__dirname, '.env.virtual.local')
  
  if (fs.existsSync(envVirtualPath)) {
    const envContent = fs.readFileSync(envVirtualPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const equalIndex = trimmedLine.indexOf('=')
        const key = trimmedLine.substring(0, equalIndex).trim()
        const value = trimmedLine.substring(equalIndex + 1).trim()
        
        // Only set if not already in process.env
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
    console.log('✅ Loaded virtual environment variables')
  }
} catch (error) {
  console.warn('⚠️ Could not load .env.virtual.local:', error.message)
}

/** @type {import('next').Config} */
const nextConfig = {
    // Image optimization with cache prevention
  images: {
    unoptimized: true, // Disable image optimization to prevent cache issues
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 0, // Set to 0 to prevent caching
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Disable image optimization to prevent cache issues
    loader: 'default',
    loaderFile: undefined,
    disableStaticImages: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "v5.airtableusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dl.airtable.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "airtableusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images",
        port: "",
        pathname: "/**",
      },
    ],
  },
  eslint: {
    dirs: ["app"], // Lint only the app directory
    ignoreDuringBuilds: true, // Ignore ESLint during builds to avoid configuration issues
  },
  // Suppress hydration warnings caused by browser extensions
  reactStrictMode: true,
  
  // Prevent cache corruption
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Optimize chunk loading for mobile
  experimental: {
    // Remove optimizePackageImports as it might cause issues on Railway
  },
  

  
  // Add error handling for missing files
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          // Security headers to enforce HTTPS and improve security
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      },
      {
        // Apply specifically to image routes
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding'
          }
        ]
      }
    ];
  },
  

  webpack: (config, { dev, isServer }) => {
    // Suppress webpack cache errors and verbose logging
    config.infrastructureLogging = {
      level: 'error',
      debug: false
    };
    
    // Suppress webpack cache warnings
    config.stats = {
      warnings: false,
      warningsFilter: [
        /webpack\.cache\.PackFileCacheStrategy/,
        /incorrect header check/,
        /Restoring failed for/,
        /ResolverCachePlugin/
      ]
    };
    
    if (dev && !isServer) {
      // Suppress hydration mismatch warnings in development
      config.ignoreWarnings = [
        // Hydration warnings
        /Warning: Text content did not match/,
        /Warning: Expected server HTML to contain/,
        /Warning: Hydration failed/,
        /Warning: A tree hydrated but some attributes/,
        /Warning: Text content does not match server-rendered HTML/,
        /Warning: Expected server HTML to contain a matching/,
        /Warning: An error occurred during hydration/,
        /Warning: The server rendered more HTML than the client/,
        /Warning: The client rendered more HTML than the server/,
        /Warning: There was an error while hydrating/,
        /Warning: Text content did not match server-rendered HTML/,
        /Warning: Expected server HTML to contain a matching.*in.*/,
        /Warning: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties/,
        /Warning: It can also happen if the client has a browser extension installed which messes with the HTML before React loaded/,
        /Warning: This can happen if a SSR-ed Client Component used/,
        /Warning: Variable input such as.*Date\.now\(\) or Math\.random\(\)/,
        /Warning: Date formatting in a user's locale which doesn't match the server/,
        /Warning: External changing data without sending a snapshot of it along with the HTML/,
        /Warning: Invalid HTML tag nesting/,
        /Warning: It can also happen if the client has a browser extension installed/,
        /Warning: https:\/\/react\.dev\/link\/hydration-mismatch/,
        // Error variations
        /Error: A tree hydrated but some attributes/,
        /Error: This can happen if a SSR-ed Client Component used/,
        /Error: It can also happen if the client has a browser extension installed/,
        /Error: https:\/\/react\.dev\/link\/hydration-mismatch/,
        // Additional patterns
        /Warning:.*data-new-gr-c-s-check-loaded/,
        /Warning:.*data-gr-ext-installed/,
        /Error:.*data-new-gr-c-s-check-loaded/,
        /Error:.*data-gr-ext-installed/,
        // Specific Grammarly attribute patterns
        /.*data-new-gr-c-s-check-loaded.*/,
        /.*data-gr-ext-installed.*/,
        // Generic hydration patterns
        /.*Hydration.*/,
        /.*hydration.*/,
        /.*server.*client.*/,
        /.*server.*HTML.*/,
        /.*client.*HTML.*/,
        /.*browser extension.*/,
        /.*Grammarly.*/,
        /.*grammarly.*/,
        // Additional comprehensive patterns
        /.*tree hydrated but some attributes.*/,
        /.*server rendered HTML.*client properties.*/,
        /.*browser extension installed.*/,
        /.*messes with the HTML.*/,
        /.*SSR-ed Client Component.*/,
        /.*Variable input such as.*/,
        /.*Date formatting in a user's locale.*/,
        /.*External changing data.*/,
        /.*Invalid HTML tag nesting.*/,
        /.*react\.dev\/link\/hydration-mismatch.*/,
      ];
    }
    
    // Simplified webpack config for Railway compatibility
    if (!dev && !isServer) {
      // Use default chunk splitting to avoid Railway issues
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },

};

module.exports = nextConfig;