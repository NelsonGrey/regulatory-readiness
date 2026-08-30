#!/bin/bash
# Runs inside the LocalStack container once it is ready.
# Creates the S3 buckets and SQS queues the engine expects in local dev.
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-eu-west-1}"

for bucket in \
  rre-dev-originals \
  rre-dev-derivatives \
  rre-dev-exports \
  rre-dev-quarantine \
  rre-dev-inbound-email
do
  awslocal s3api create-bucket \
    --bucket "$bucket" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  echo "created s3 bucket: $bucket"
done

for queue in \
  rre-dev-scan \
  rre-dev-ocr \
  rre-dev-extraction \
  rre-dev-export \
  rre-dev-notify \
  rre-dev-events
do
  awslocal sqs create-queue --queue-name "$queue" >/dev/null
  awslocal sqs create-queue --queue-name "${queue}-dlq" >/dev/null
  echo "created sqs queue: $queue (+ dlq)"
done

echo "localstack bootstrap complete"
