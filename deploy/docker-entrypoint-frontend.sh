#!/bin/sh
set -eu
: "${BACKEND_URL:?BACKEND_URL must point to the Railway backend service}"
envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
