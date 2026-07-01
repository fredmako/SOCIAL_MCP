#!/bin/bash
# Run this script ON YOUR DIGITALOCEAN DROPLET to set up GitHub SSH access
# Usage: bash droplet_setup.sh

echo "=== Setting up GitHub SSH on DigitalOcean Droplet ==="
echo ""

# Step 1: Install required packages
echo "[1/5] Installing required packages..."
apt-get update -qq
apt-get install -y -qq curl git > /dev/null 2>&1

# Step 2: Check if SSH key exists on droplet
echo "[2/5] Checking SSH keys on droplet..."
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "Generating new SSH key for droplet..."
    ssh-keygen -t ed25519 -C "root@$(hostname)" -f ~/.ssh/id_ed25519 -N ""
else
    echo "SSH key already exists on droplet."
fi

# Step 3: Start ssh-agent and add key
echo "[3/5] Configuring SSH agent..."
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519 2>/dev/null || true

# Step 4: Display the droplet's public key
echo ""
echo "=== STEP 4: ADD THIS PUBLIC KEY TO GITHUB ==="
echo "Copy the ENTIRE key below and add it to GitHub:"
echo ""
cat ~/.ssh/id_ed25519.pub
echo ""
echo "=== END OF PUBLIC KEY ==="
echo ""
echo "TO ADD TO GITHUB:"
echo "1. Copy the key above"
echo "2. Go to: https://github.com/settings/keys"
echo "3. Click 'New SSH key'"
echo "4. Name it: 'DigitalOcean Droplet'"
echo "5. Paste the key and click 'Add SSH key'"
echo ""
read -p "Press ENTER after you've added the key to GitHub..."

# Step 5: Configure git and test
echo ""
echo "[5/5] Configuring Git and testing connection..."

# Change remote to SSH
git remote set-url origin git@github.com:fredmako/SOCIAL_MCP.git

# Test SSH connection
echo "Testing SSH connection to GitHub..."
ssh -T git@github.com

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Now you can push changes with:"
echo "  git push origin main"