FROM mcr.microsoft.com/mssql/server:2019-latest

USER root

# RUN apt-get update && apt-get install -y sudo
# RUN echo "mssql ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
# USER mssql
# Create a config directory
# RUN chgrp -R 0 mssql 
# RUN chmod -R g=u mssql
# RUN chown -R 10001:0 mssql

RUN echo 
RUN mkdir -p /usr/config
WORKDIR /usr/config

# Bundle config source
COPY . /usr/config


# Grant permissions for to our scripts to be executable
RUN chmod +x /usr/config/entrypoint.sh
RUN chmod +x /usr/config/configure-db.sh

ENTRYPOINT ["./entrypoint.sh"]