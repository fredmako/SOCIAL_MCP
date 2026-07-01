# Add SSH Key to GitHub - INSTANT FIX

## YOUR LOCAL PUBLIC KEY (add this to GitHub)
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICdfq3N5DIQM02D4qpWfHZeJEKiVEQOhwR2wPtqzjSfY user@CHRIS
```

## STEPS:

1. Copy the key above
2. Go to: https://github.com/settings/keys
3. Click "New SSH key"
4. Title: "Windows Machine"
5. Paste the key
6. Click "Add SSH key"

## AFTER ADDING THE KEY:

Then run this in Git Bash (Windows):
```bash
git push origin main
```

## WHY THIS IS NEEDED:

GitHub removed password authentication in 2021. You must use SSH keys.
Your Windows machine has an SSH key at C:/Users/USER/.ssh/id_ed25519
This key needs to be registered in your GitHub account.

## VERIFY IT WORKS:

After adding the key, test with:
```bash
ssh -T git@github.com
```

Expected output: "Hi fredmako! You've successfully authenticated..."

## FOR DIGITALOCEAN DROPLET:

The droplet needs its OWN SSH key added to GitHub as well.
SSH into your droplet and run: bash droplet_setup.sh
(You'll need to copy this project folder to the droplet first, or create the file manually)