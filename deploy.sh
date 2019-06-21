#!/usr/bin/env bash
echo AWS profile?
read profile

export AWS_ACCESS_KEY_ID=`aws configure get ${profile}.aws_access_key_id`
export AWS_SECRET_ACCESS_KEY=`aws configure get ${profile}.aws_secret_access_key`
export AWS_DEFAULT_REGION=`aws configure get ${profile}.region`

docker build -t scrape-lambda .
docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY scrape-lambda yarn sls --region ${AWS_DEFAULT_REGION} deploy

