#!/bin/bash

printf "%s orderer0.ordererOrg1.example.com\n" $CORE_O1_ENDPOINT >> /etc/hosts
printf "%s orderer1.ordererOrg1.example.com\n" $CORE_O2_ENDPOINT >> /etc/hosts
printf "%s orderer0.ordererOrg2.example.com\n" $CORE_O3_ENDPOINT >> /etc/hosts
printf "%s orderer1.ordererOrg2.example.com\n" $CORE_O4_ENDPOINT >> /etc/hosts
node server.js
