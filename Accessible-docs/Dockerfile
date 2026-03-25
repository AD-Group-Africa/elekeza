# Use official lightweight Python 3.11 image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout for better logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies (ADDED: build-essential for C++ compilation)
RUN apt-get update && apt-get install -y \
    build-essential \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheel first to prevent build errors
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# CRITICAL FIX: Install CPU-only PyTorch FIRST.
# This prevents Docker from hanging while downloading the 5GB GPU version.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy requirements file
COPY requirements.txt .

# Install the rest of the dependencies (with a longer timeout just in case)
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# Copy the entire application code
COPY . .

# This prevents the 400MB download on every single container startup!
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-base-en-v1.5')"

# Expose the port the FastAPI app runs on
EXPOSE 8000

# Command to run the Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]