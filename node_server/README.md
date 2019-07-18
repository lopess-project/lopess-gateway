# Node Server

It is recommended that this service is deployed within the docker swarm cluster. Therfore join the swarm and do the following:

1. Adjust the compose file with the proper orderer endpoints (somehow they are not discovered by discovery service).

`$ docker service inspect <name of orderer>`

2. Build a docker image for the node server

`$ docker build -t hlf/node-server . `

3. Deploy the docker image in the overlay network

`$ docker stack deploy --compose-file docker-compose-node-server.yaml net`






