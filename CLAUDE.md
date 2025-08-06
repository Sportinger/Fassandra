## Development and Production Infrastructure

- We always use docker on dev and on prod.
- `show docker`: SSH command to list running Docker containers on a specific server
  ```
  ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 'docker ps'
  ```
- Quick production update script location: `/home/admins/projects/pessoa/deploy.dev.sh`