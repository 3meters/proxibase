# Set nginx base image
FROM nginx

ENV port 8443

# Copy custom configuration file from the current directory
ADD nginx.conf /etc/nginx/nginx.conf

ADD keys/dev.pem /etc/ssl/
ADD keys/dev.crt /etc/ssl/

EXPOSE $port
