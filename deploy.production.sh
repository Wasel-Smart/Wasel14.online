#!/usr/bin/env sh

# abort on errors
set -e

echo '====================================================================================='
echo '=============================...DEPLOYING PRODUCTION...============================='
echo '====================================================================================='

npm run build

echo '====================================================================================='
echo '=====================================...BUILD...====================================='
echo '====================================================================================='

# navigate into the build output directory

rm -rf deploy
mkdir deploy
cp -r ./dist ./deploy/dist
cp -r ./package.json ./deploy/package.json
cp -r ./package-lock.json ./deploy/package-lock.json
cp -r ./vercel.json ./deploy/vercel.json
# SECURITY: never copy .env* files into the deploy payload. Vite has already inlined
# the VITE_* values into dist/ during the build above, and everything else (server
# secrets) must live in Vercel / Supabase secret management, not in a pushed repo.
cd deploy

git init
git add -A
git commit -m 'deploy'

echo '====================================================================================='
echo '==================================...PUSHING GIT...=================================='
echo '====================================================================================='
git push -f "${DEPLOY_REMOTE:-master}" master
cd -

rm -rf deploy
rm -rf dist

green=$(tput setaf 2)
reset=$(tput sgr0)
now=$(date +"%T")

echo "${green}====================================================================================="
echo "${green}=======================...DEPLOY SUCCESS PRODUCTION AT $now...======================"
echo "${green}=====================================================================================${reset}"
