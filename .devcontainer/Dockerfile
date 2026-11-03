# Use the official Python 3.12 slim image
FROM python:3.12-slim

# Install system dependencies and apply available Debian security updates
# Includes the Brotli fix for CVE-2026-111497.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        libpq-dev \
        gcc \
        libbrotli1 \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /workspace

# Expose port 8000 for Django development
EXPOSE 8000