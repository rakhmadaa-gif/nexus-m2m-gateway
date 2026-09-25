# Nexus M2M Gateway (Cloudflare Worker)

Front door untuk Nexus Gateway. Kenapa perlu: pemeriksa x402-list membaca
sinyal situs dari **domain root**, sedangkan domain root supabase.co tidak
bisa kita atur. Worker ini menyajikan semua halaman discovery di root
`nexus-m2m-gateway.rakhmadaa.workers.dev` dan meneruskan semua panggilan
API (billing, x402, 402) ke engine Supabase tanpa perubahan.

## Rute lokal worker (yang dicek x402-list)
- `/` → homepage HTML
- `/llms.txt` → dokumen agen (text/plain)
- `/openapi.json` → OpenAPI 3.1 (application/json)
- `/pricing` → halaman harga HTML
- `/robots.txt` → robots + Sitemap
- `/terms` → syarat layanan HTML
- Semua path lain → proxy transparan ke Supabase (method, header, body, 402 dipertahankan)

## Deploy (dari sandbox)
```bash
cd /root/workspace/nexus-m2m-gateway
CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy
```

## Token Cloudflare yang dibutuhkan
Dashboard Cloudflare → My Profile → API Tokens → Create Token:
- **Account / Cloudflare Workers Scripts : Edit**
- **User / User Details : Read**

## Setelah deploy
1. Verifikasi: `curl https://nexus-m2m-gateway.rakhmadaa.workers.dev/llms.txt`
2. Email info@x402-list.com minta update base_url ke
   `https://nexus-m2m-gateway.rakhmadaa.workers.dev` (self-service update
   terblokir: domain-proof harus di root platform workers.dev).
