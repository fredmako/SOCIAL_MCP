# Setup GitHub SSH Access on DigitalOcean Droplet

## Problem
GitHub no longer accepts password authentication for Git operations. You must use SSH keys.

## Solution

### Step 1: Add SSH key to GitHub (do this ONCE)

Your local public key is:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICdfq3N5DIQM02D4qpWfHZeJEKiVEQOhwR2wPtqzjSfY user@CHRIS
```

**Option A: Manual (easiest)**
1. Copy the public key above
2. Go to: https://github.com/settings/keys
3. Click "New SSH key"
4. Name it: "DigitalOcean Droplet"
5. Paste the key and save

**Option B: Using the script**
```bash
cd path/to/social-mcp
chmod +x setup_github_ssh.sh
bash setup_github_ssh.sh
# Follow the instructions displayed
```

### Step 2: Configure Git on DigitalOcean Droplet

SSH into your droplet and run these commands:

```bash
# Change remote URL from HTTPS to SSH
git remote set-url origin git@github.com:fredmako/SOCIAL_MCP.git

# Verify the change
git remote -v

# Test SSH connection (should say "Hi fredmako! You've successfully authenticated")
ssh -T git@github.com

# Push your changes
git push origin main
```

### Step 3: Verify Everything Works

```bash
# Check git status
git status

# Pull latest changes
git pull origin main

# Push any new changes
git push origin main
```

## Your Current Status

From the screenshot, your repo URL is currently:
```
https://github.com/fredmako/SOCIAL_MCP.git
```

This needs to be changed to:
```
git@github.com:fredmako/SOCIAL_MCP.git
```

## Troubleshooting

If you get "Permission denied (publickey)":
```bash
# Ensure SSH agent is running
eval "$(ssh-agent -s)"

# Add your key
ssh-add ~/.ssh/id_ed25519

# Test again
ssh -T git@github.com
```

## Summary

- GitHub disabled password authentication in 2021
- All Git operations now require SSH keys or Personal Access Tokens
- SSH is the recommended method (no token expiration issues)
- You only need to set this up once