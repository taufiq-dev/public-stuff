# 💡 Simplifying Environment Variables in Rsbuild: Say Goodbye to env-cmd

If you're using env-cmd to manage environment variables like the example below in your Rsbuild project, you're adding unnecessary complexity to your build process.

```json
// package.json
{
  // ...
  "scripts": {
    "build:sit": "env-cmd -f .env.sit rsbuild build",
    "build:uat": "env-cmd -f .env.uat rsbuild build",
    "build:prd": "env-cmd -f .env.prd rsbuild build"
  },
  "dependencies": {
    // ...
  },
  "devDependencies": {
    "env-cmd": "^10.1.0"
    // other devDependencies
  }
}
```

## The Problem: React App with Different API Endpoints

John is building a React app that calls a backend API. He needs different API URLs for different environments:

```bash
# .env.sit
REACT_APP_API_URL=http://localhost:3001

# .env.uat  
REACT_APP_API_URL=https://uat-api.myapp.com

# .env.prd
REACT_APP_API_URL=https://api.myapp.com
```

In his React component:
```jsx
// App.jsx
const apiUrl = process.env.REACT_APP_API_URL;

fetch(`${apiUrl}/users`)
  .then(response => response.json())
  .then(data => setUsers(data));
```

Not knowing Rsbuild's built-in environment handling, John installs `env-cmd` to switch between these files for different builds.

## The Solution: Use Rsbuild's Built-in Environment Support

Rsbuild has native support for environment variables through the `loadEnv` utility and `envMode` configuration. Here's how to eliminate `env-cmd` completely:

### Step 1: Organize Your Environment Files

You can keep your environment files in the root or organize them in a dedicated folder:

```
project/
├── env/
│   ├── .env.sit
│   ├── .env.uat
│   └── .env.prd
├── src/
└── rsbuild.config.ts
```

### Step 2: Configure rsbuild.config.ts

```typescript
import { defineConfig, loadEnv } from '@rsbuild/core';

export default defineConfig(({ envMode }) => {
  // Load environment variables from the env/ folder
  // You can also use cwd: '.' for root directory
  const { publicVars } = loadEnv({
    cwd: 'env',
    mode: envMode,
    prefixes: ['REACT_APP_'], // Only load vars starting with REACT_APP_
  });
  
  return {
    source: {
      define: {
        // publicVars automatically includes both process.env.* and import.meta.env.* variants
        ...publicVars,
        // Add other variables as needed
        'process.env.REACT_APP_ENV': JSON.stringify(envMode),
      },
    },
    // other config options...
  };
});
```

### Step 3: Update Your package.json Scripts

Remove `env-cmd` dependency and simplify your scripts:

```json
{
  "scripts": {
    "dev": "rsbuild dev",
    "build:sit": "rsbuild build --env-mode sit",
    "build:uat": "rsbuild build --env-mode uat", 
    "build:prd": "rsbuild build --env-mode prd"
  },
  "devDependencies": {
    // env-cmd removed!
    "@rsbuild/core": "^1.0.0"
    // other devDependencies
  }
}
```

### Step 4: Clean Up

1. Remove `env-cmd` from your dependencies:
   ```bash
   npm uninstall env-cmd
   ```

2. Your React component code stays exactly the same:
   ```jsx
   // App.jsx - no changes needed!
   const apiUrl = process.env.REACT_APP_API_URL;
   
   fetch(`${apiUrl}/users`)
     .then(response => response.json())
     .then(data => setUsers(data));
   ```

## Benefits of This Approach

- **No extra dependencies**: One less package to maintain and update
- **Native Rsbuild integration**: Better performance and fewer compatibility issues  
- **Cleaner build process**: Direct environment mode switching via CLI flags
- **Better organization**: Environment files can be organized in folders
- **Flexible prefixes**: Support any prefix pattern (REACT_APP_, VITE_, PUBLIC_, etc.)
- **Type safety**: When using TypeScript, you get better integration with Rsbuild's typing

## Understanding the `prefixes` Option

The `prefixes` option controls which environment variables are considered "public" and safe to expose in client-side code. By default, Rsbuild only loads variables starting with `PUBLIC_`, but you can customize this to include other prefixes like `REACT_APP_`.

```bash
# Only REACT_APP_ variables will be available in client code
REACT_APP_API_URL=https://api.myapp.com  # ✅ Available
REACT_APP_DEBUG=true                     # ✅ Available  
DATABASE_PASSWORD=secret123              # ❌ Not available (no REACT_APP_ prefix)
```

When you use `prefixes: ['REACT_APP_']`, loadEnv returns a `publicVars` object that includes both `process.env.*` and `import.meta.env.*` variants, already formatted and ready for use:

```typescript
// What publicVars contains:
{
  'process.env.REACT_APP_API_URL': '"https://api.myapp.com"',
  'import.meta.env.REACT_APP_API_URL': '"https://api.myapp.com"',
  'process.env.REACT_APP_DEBUG': '"true"',
  'import.meta.env.REACT_APP_DEBUG': '"true"'
}
```

### Multiple Environment Variables

### Multiple Environment Variables

```typescript
export default defineConfig(({ envMode }) => {
  const { publicVars } = loadEnv({
    cwd: 'env',
    mode: envMode,
    prefixes: ['REACT_APP_', 'VITE_'], // Support multiple prefixes
  });
  
  return {
    source: {
      define: {
        ...publicVars, // Includes all REACT_APP_* and VITE_* variables
        'process.env.NODE_ENV': JSON.stringify(envMode === 'prd' ? 'production' : 'development'),
      },
    },
  };
});
```

### Environment-Specific Configuration

```typescript
export default defineConfig(({ envMode }) => {
  const { publicVars } = loadEnv({
    cwd: 'env',
    mode: envMode,
    prefixes: ['REACT_APP_'], // Only load REACT_APP_ prefixed variables
  });
  const isProd = envMode === 'prd';
  
  return {
    source: {
      define: {
        ...publicVars, // All REACT_APP_* variables are automatically included
      },
    },
    output: {
      minify: isProd,
      sourceMap: !isProd,
    },
    // other environment-specific configs...
  };
});
```

By leveraging Rsbuild's native environment handling, you get a cleaner, more maintainable build process without external dependencies.