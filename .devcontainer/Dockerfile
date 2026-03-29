# Use the official Python 3.11 slim image
FROM python:3.11-slim

# Install system dependencies (git, PostgreSQL client, and build tools)
RUN apt-get update && apt-get install -y \
    git \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /workspace

# Expose port 8000 for Django development
EXPOSE 8000

