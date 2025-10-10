#!/bin/bash

# Export YJS base state from database
ssh -i ~/.ssh/id_rsa_lexema_de admin@91.99.69.115 \
  "docker exec mylayer_fassandra_db psql -U postgres -d pessoa_db -t -A -c \"COPY (SELECT base_state FROM yjs_base_states WHERE script_id = '7ed36524-dfb5-4c29-8240-a3ffa4b984ed') TO STDOUT\"" \
  > /tmp/marquise_raw_state.bin

echo "Exported base state to /tmp/marquise_raw_state.bin"
ls -lh /tmp/marquise_raw_state.bin
