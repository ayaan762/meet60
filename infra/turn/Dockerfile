# Simple coturn image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y coturn && rm -rf /var/lib/apt/lists/*
COPY turnserver.conf /etc/turnserver.conf
EXPOSE 3478/udp
EXPOSE 3478/tcp
# Verbose for initial debugging; remove -v later
CMD ["turnserver","-c","/etc/turnserver.conf","-v"]
