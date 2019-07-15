#!/bin/sh

server=`uci get customized_script.general.para1`
port=`uci get customized_script.general.para2`
CHECK_INTERVAL=2


old=`date +%s`

#Run Forever
while [ 1 ]
do
	now=`date +%s`
	
	# Check if there is sensor data arrive at /var/iot/channels/ every 5 seconds
	if [ `expr $now - $old` -gt $CHECK_INTERVAL ];then
		old=`date +%s`
		CID=`ls /var/iot/channels/`
		if [ -n "$CID" ];then
			for channel in $CID; do
				channelModulo=$((channel%2))
				if [[ $channelModulo -eq 1 ]];then
					data=`cat /var/iot/channels/$channel`
					channel2=$((channel+1))
					data2=`cat /var/iot/channels/$channel2`
					if [ -n "$data2" ];then
						payload=`printf '{"msg":"%s","sig":"%s"}' $data $data2`
						curl -X POST -H 'Content-Type: application/json' -d $payload $server:$port							
						rm /var/iot/channels/$channel
						rm /var/iot/channels/$channel2
					fi
				fi
			done
		fi
	fi
done