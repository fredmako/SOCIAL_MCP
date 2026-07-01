#!/bin/bash
# GitHub SSH Setup Script for DigitalOcean Droplet
# This script will help you set up SSH authentication for GitHub

echo "=== GitHub SSH Setup ==="
echo ""

# Step 1: Check if SSH key exists
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "Generating new SSH key..."
    ssh-keygen -t ed25519 -C "cit2220542021@mmu.ac.ke" -f ~/.ssh/id_ed25519 -N ""
else
    echo "SSH key already exists."
fi

# Step 2: Start ssh-agent
echo "Starting ssh-agent..."
eval "$(ssh-agent -s)"

# Step 3: Add SSH key to ssh-agent
echo "Adding SSH key to ssh-agent..."
ssh-add ~/.ssh/id_ed25519 2>/dev/null || true

# Step 4: Display the public key
echo ""
echo "=== YOUR SSH PUBLIC KEY ==="
echo "Copy this entire key below:"
echo ""
cat ~/.ssh/id_ed25519.pub
echo ""
echo "=== END OF PUBLIC KEY ==="
echo ""

# Step 5: Instructions
echo "NEXT STEPS:"
echo "1. Copy the public key shown above"
echo "2. Go to https://github.com/settings/keys"
echo "3. Click 'New SSH key'"
echo "4. Paste the key and save"
echo ""
echo "After adding the key to GitHub, run:"
echo "  git remote set-url origin git@github.com:fredmako/SOCIAL_MCP.git"
echo "  ssh -T git@github.com"
echo "  git push origin main"