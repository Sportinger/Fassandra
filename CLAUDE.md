## Development and Production Infrastructure

- We always use docker on dev and on prod.
- `show docker`: SSH command to list running Docker containers on a specific server
  ```
  ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 'docker ps'
  ```
- Quick production update script location: `/home/admins/projects/pessoa/scripts/deploy.dev.sh`

## Conversation Handling

- If the user suddenly changes the topic to something seemingly completely different, first ask the user if they are in the right chat to avoid wrong context.