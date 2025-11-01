# Guide to Share This Project via Git

## For You (The Project Owner)

### 1. **Verify Sensitive Files Are Protected**

✅ Already protected:
- `.env` files (already in `.gitignore`)
- `.cursor/mcp.json` (now added to `.gitignore`)

### 2. **Commit Your Changes**

```bash
# Review what will be committed
git status

# Stage all changes (or be selective)
git add .

# Create a descriptive commit
git commit -m "Add project files and configuration"

# Or commit specific files:
git add .gitignore
git add app/
git add supabase/
git commit -m "Update project structure"
```

### 3. **Push to GitHub**

```bash
# Push to your remote repository
git push origin main

# If this is the first push and branch doesn't exist remotely:
git push -u origin main
```

### 4. **Verify Your Remote**

Your current remote is: `https://github.com/SDMane/cursor-course.git`

To change it or add a new remote:
```bash
# View current remotes
git remote -v

# Change the remote URL
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Or add a new remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

---

## For The Person Receiving The Project

### 1. **Clone the Repository**

```bash
git clone https://github.com/SDMane/cursor-course.git
cd cursor-course
```

### 2. **Set Up Environment Variables**

The project needs several API keys. Create these files:

**Root `.env` file** (for Task Master and Next.js):
```bash
# Copy example if it exists, or create new
cp .env.example .env  # If example exists
# OR create manually
touch .env
```

Add these variables to `.env`:
```
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here  # Optional
```

**Next.js App `.env.local`** (in `app/` directory):
```bash
cd app
touch .env.local
```

Add:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Supabase Functions `.env`** (in `supabase/functions/`):
```bash
cd supabase/functions
touch .env
```

Add:
```
OPENAI_API_KEY=your_openai_key_here
```

### 3. **Install Dependencies**

```bash
# From project root
npm install

# For the Next.js app
cd app
npm install
cd ..
```

### 4. **Set Up Supabase (Local Development)**

```bash
# Ensure Docker is running
# Then start Supabase locally
npx supabase start
```

After starting, copy the `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the output to `app/.env.local`.

### 5. **Set Up Task Master (Optional but Recommended)**

1. Install Task Master globally or locally:
   ```bash
   npm install -g task-master-ai
   ```

2. Configure Task Master MCP in Cursor:
   - Open `.cursor/mcp.json` (they'll need to create this)
   - Add Task Master configuration (see `mcp_template.json` for reference)
   - Add API keys to the `env` section:
     ```json
     {
       "env": {
         "ANTHROPIC_API_KEY": "your_key_here"
       }
     }
     ```

### 6. **Run the Development Servers**

**Terminal 1 - Supabase Functions:**
```bash
npx supabase functions serve --import-map ./supabase/functions/import_map.json
```

**Terminal 2 - Next.js App:**
```bash
cd app
npm run dev
```

---

## What Should NOT Be Shared

These files are already in `.gitignore`:
- ✅ `.env` files
- ✅ `.cursor/mcp.json` (contains API keys)
- ✅ `node_modules/`
- ✅ `.next/` (Next.js build files)
- ✅ Log files

**Important:** Never commit files containing:
- API keys
- Personal access tokens
- Database credentials
- Private keys

---

## Troubleshooting

### If someone can't clone:
- Verify the repository is public or they have access
- Check the repository URL is correct

### If environment variables are missing:
- Share the list of required variables (see above)
- Provide example `.env` files (without real keys)
- Document where each API key can be obtained

### If dependencies fail to install:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Quick Checklist for Sharing

**Before sharing:**
- [ ] All sensitive files are in `.gitignore`
- [ ] No API keys in committed files
- [ ] README.md has setup instructions
- [ ] All changes are committed
- [ ] Code is pushed to remote repository

**After someone clones:**
- [ ] They create their own `.env` files
- [ ] They install dependencies (`npm install`)
- [ ] They set up Supabase locally (`npx supabase start`)
- [ ] They configure their own API keys
- [ ] They can run the development server

