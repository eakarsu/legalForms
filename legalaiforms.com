# HTTP to HTTPS redirect
server {
    listen 80;
    server_name legalaiforms.com www.legalaiforms.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    server_name legalaiforms.com www.legalaiforms.com;

    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/legalaiforms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/legalaiforms.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Main application proxy
    location / {
        proxy_pass http://localhost:5011;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        client_max_body_size 20M;
    }

    # Logging
    access_log /var/log/nginx/legalaiforms_access.log;
    error_log /var/log/nginx/legalaiforms_error.log;
}

