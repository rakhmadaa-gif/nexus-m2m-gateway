/**
 * Nexus M2M Gateway — Cloudflare Worker front door.
 *
 * Purpose: x402-list site-signal checker probes the DOMAIN ROOT of the
 * service URL. supabase.co roots are platform-controlled 404s, so 5/6
 * site signals were structurally unreachable. This worker serves all
 * discovery pages at the root of nexus-m2m-gateway.<account>.workers.dev
 * and transparently proxies every other request to the Supabase Edge
 * Function (the real engine, billing, and x402 rails stay there).
 *
 * Routes (GET, text/plain unless noted):
 *   /                    -> HTML homepage (200, no redirect)
 *   /llms.txt            -> agent doc (text/plain; charset=utf-8)
 *   /openapi.json        -> OpenAPI 3.1 (application/json)
 *   /pricing             -> HTML pricing page
 *   /robots.txt          -> robots with Sitemap line
 *   /terms               -> HTML terms page
 *   /pricing.manifest.json, /manifest.json, /samples, /metrics,
 *   /gateway/dry-run, /v1/*, /evm-sentinel/*, /ingest/*, /poa/*
 *   and everything else -> proxied to Supabase (methods preserved).
 */

const SUPABASE_FUNCTION_URL =
  "https://xibzsthfrbomefnvbicb.supabase.co/functions/v1/hello-world";

// ---------- HTML page helpers (checker requires HTML at root) ----------

const htmlPage = (title, description, bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://nexus-m2m-gateway.rakhmadaa.workers.dev/">
</head>
<body>
${bodyHtml}
</body>
</html>`;

const HEADER = `<header><h1>Nexus Gateway</h1>
<p>EVM Sentinel + M2M legal-code gateway for Web3. Solidity security scans
for AI agents, bilingual (EN/ID) legal-code contracts, structured data
payloads. Payments in USDC on Polygon PoS via the x402 protocol (HTTP 402).</p>
<p><a href="https://rakhmadaa-gif.github.io/nexus-core-gateway/">Human-friendly site</a> ·
<a href="/llms.txt">Agent doc (llms.txt)</a> ·
<a href="/openapi.json">OpenAPI 3.1</a> ·
<a href="/pricing">Pricing</a> ·
<a href="/terms">Terms</a></p></header><hr>`;

const HOMEPAGE = htmlPage(
  "Nexus Gateway — EVM Sentinel & M2M Legal-Code Gateway",
  "Solidity security scans (honeypot check, drainer detection, 9+2 breach scenarios), bilingual EN/ID legal-code contracts, and structured data payloads for AI agents. x402 payments in USDC on Polygon PoS.",
  `${HEADER}
<main>
<h2>Security scans (EVM Sentinel)</h2>
<ul>
<li><b>POST /evm-sentinel/v1/scan-quick</b> — $0.05 USDC. Fast honeypot / access-control scan. Output: risk_score, breach_scenarios, gas_ratio, action (ALLOW|BLOCK).</li>
<li><b>POST /evm-sentinel/v1/scan-deep</b> — $0.50 USDC. Full breach analysis: BS-001..BS-009 + Permit2 wallet-drainer detection (BS-010) + arbitrage-execution manipulation (BS-011). 1h result cache.</li>
</ul>
<p>Read-only static scan — no wallet approval required.</p>

<h2>Other services</h2>
<ul>
<li><b>POST /v1/code-modules</b> — EVM Sentinel Quick Scan: audited Solidity module (ERC20/ERC721/ESCROW) + 5-point security audit report. $1.20 USDC.</li>
<li><b>POST /v1/legal-code</b> — Hybrid Legal-Code Pro: bilingual EN/ID legal contract mapped to code functions. $300 light / $450 standard / $800 enterprise USDC.</li>
<li><b>POST /v1/structured-data</b> — Verified structured data payloads for Web3, regulatory compliance, cross-platform orchestration. $0.20 USDC.</li>
</ul>

<h2>Free endpoints</h2>
<ul>
<li><b>POST /gateway/dry-run</b> — free Solidity security dry-run (9 breach scenarios, gas asymmetry ratio, ERC-4626 vault awareness).</li>
<li><b>GET /manifest.json</b> — A2A agent discovery manifest.</li>
<li><b>GET /samples</b> — free multi-tier sample manifests.</li>
<li><b>GET /metrics</b> — live telemetry.</li>
<li><b>GET /pricing.manifest.json</b> — machine-readable pricing.</li>
</ul>

<h2>Payment protocol (x402)</h2>
<p>Every paid call requires an <code>x-client-id</code> header (any stable string
identifying your agent). Without credits the endpoint answers HTTP 402 with an
x402 payment-required header (base64 JSON envelope, x402Version 2, exact scheme,
network eip155:137, asset USDC on Polygon PoS). Pay with any x402 client, or use
the built-in EIP-712 pull-payment rail (gateway contract
0x2a3D917379Bf94D7B6f239D6BcbBdD7cD8543683 on Polygon PoS).</p>
</main>`
);

const PRICING = htmlPage(
  "Nexus Gateway — Pricing",
  "Pricing for Nexus Gateway services: scan-quick $0.05, scan-deep $0.50, structured data $0.20, code modules $1.20, legal-code $300/$450/$800 USDC on Polygon PoS via x402.",
  `${HEADER}
<main>
<h2>Pricing (USDC on Polygon PoS, x402 exact)</h2>
<table border="1" cellpadding="6">
<tr><th>Service</th><th>Endpoint</th><th>Price</th></tr>
<tr><td>EVM Sentinel Quick-Check</td><td>POST /evm-sentinel/v1/scan-quick</td><td>$0.05 USDC</td></tr>
<tr><td>EVM Sentinel Deep-Scan</td><td>POST /evm-sentinel/v1/scan-deep</td><td>$0.50 USDC</td></tr>
<tr><td>Structured data payload</td><td>POST /v1/structured-data</td><td>$0.20 USDC</td></tr>
<tr><td>Code module (audited Solidity)</td><td>POST /v1/code-modules</td><td>$1.20 USDC</td></tr>
<tr><td>Legal-code hybrid (light)</td><td>POST /v1/legal-code</td><td>$300 USDC</td></tr>
<tr><td>Legal-code hybrid (standard)</td><td>POST /v1/legal-code</td><td>$450 USDC</td></tr>
<tr><td>Legal-code hybrid (enterprise)</td><td>POST /v1/legal-code</td><td>$800 USDC</td></tr>
</table>
<p>Machine-readable pricing: <a href="/pricing.manifest.json">/pricing.manifest.json</a>.
Free: dry-run, manifest, samples, metrics. Surge pricing may apply at high load
(1.0x / 1.5x / 2.5x by request rate). 1 USDC = 100 credits; 1 credit = $0.01.</p>
</main>`
);

const TERMS = htmlPage(
  "Nexus Gateway — Terms of Service",
  "Terms of service for the Nexus Gateway M2M legal-code and security scan service.",
  `${HEADER}
<main>
<h2>Terms of Service</h2>
<p><b>Service.</b> Nexus Gateway provides static code analysis ("scans"),
generated Solidity modules, generated legal-contract drafts, and structured
data payloads via HTTP APIs. Scans are static, read-only analysis of
source code you submit; they are not a substitute for a full professional
audit, and no scan result is a guarantee of security.</p>
<p><b>Payment.</b> Services are paid per call in USDC on Polygon PoS via the
x402 protocol (HTTP 402) or the EIP-712 pull-payment rail. Payments are
non-refundable once a response payload is generated. Prices are listed at
<a href="/pricing">/pricing</a>.</p>
<p><b>Generated output.</b> Generated Solidity code and legal-contract drafts
are provided "as is". You are responsible for reviewing, testing, and
validating all generated output before use. Legal-contract drafts are not
legal advice; consult a licensed attorney for your jurisdiction.</p>
<p><b>No warranty; limitation of liability.</b> The service is provided
without warranty of any kind. To the maximum extent permitted by law,
liability is limited to the amount paid for the individual call that gave
rise to the claim.</p>
<p><b>Acceptable use.</b> Do not submit code you have no right to analyze,
do not attempt to disrupt the service, and do not use generated output to
harm third parties.</p>
<p><b>Privacy.</b> Submitted code is processed to produce the response and
may be cached (scan results, 1 hour). We do not sell submitted code.</p>
<p><b>Contact.</b> rakhmadaa@gmail.com — subject line [SECURITY-INQUIRY] for
security matters.</p>
</main>`
);

// ---------- text assets ----------

const LLMS_TXT = `# Nexus Gateway

> EVM Sentinel + M2M legal-code gateway for Web3. High-speed static
> security scans for AI agents (honeypot check, drainer detection,
> 9+2 breach scenarios), a bilingual (English/Indonesian) legal contract
> generator mapped to code functions, and structured data payloads.
> Read-only static scan, no wallet approval required. Pay per call in
> USDC on Polygon PoS via the x402 protocol (HTTP 402). No account, no
> API key: identify with the x-client-id header, then pay when the
> endpoint answers 402.

Base URL: https://nexus-m2m-gateway.rakhmadaa.workers.dev
Human site: https://rakhmadaa-gif.github.io/nexus-core-gateway/
OpenAPI 3.1: https://nexus-m2m-gateway.rakhmadaa.workers.dev/openapi.json
Pricing manifest (JSON): https://nexus-m2m-gateway.rakhmadaa.workers.dev/pricing.manifest.json

## Security scans (paid, x402 exact, USDC on Polygon PoS eip155:137)

- POST /evm-sentinel/v1/scan-quick — Quick-Check, $0.05 USDC. Fast
  honeypot / access-control scan. Input: {"solidity_code":"..."}.
  Output: { "risk_score": 0.0-1.0, "breach_scenarios": ["BS-001", ...],
  "gas_ratio": number, "action": "ALLOW" | "BLOCK" }.
- POST /evm-sentinel/v1/scan-deep — Deep-Scan, $0.50 USDC. Full breach
  analysis: 9 core scenarios (BS-001..BS-009) + Permit2-drain detection
  (BS-010) + arbitrage-execution manipulation (BS-011), with per-scenario
  detail, mitigations, and recommendations. Same input; richer output.
  Results cached 1 hour — repeat scans of the same code return in ~50ms.
  Read-only static scan, no wallet approval required.

## Other endpoints (paid, x402 exact, USDC on Polygon PoS eip155:137)

- POST /v1/code-modules — EVM Sentinel Quick Scan. Generate an audited
  Solidity module (ERC20/ERC721/ESCROW) with a 5-point security audit
  report. Body: {"service_type":"code_modules","params":{"type":"ERC20","name":"...","symbol":"..."}}.
  $1.20 per call.
- POST /v1/legal-code — Hybrid Legal-Code Pro. Generate a bilingual
  EN/ID legal contract mapped to code functions. Body:
  {"service_type":"legal_code","params":{"contract_type":"escrow","tier":"standard","parties":["A","B"],"jurisdiction":"ID","amount":"1000","currency":"USDC"}}.
  $300 light / $450 standard / $800 enterprise per call.
- POST /v1/structured-data — Verified structured data payloads for
  Web3, regulatory compliance, and cross-platform orchestration. Body:
  {"service_type":"structured_data","params":{"type":"ERC20","name":"...","symbol":"..."}}.
  $0.20 per call.

## Free endpoints (no payment, no x-client-id)

- POST /gateway/dry-run — free Solidity security dry-run: 9 breach
  scenarios (BS-001..BS-009), gas asymmetry ratio, ERC-4626 vault
  awareness, nonce/replay defense. Use this to pre-check any contract
  before deploying or before buying a paid scan.
- GET /manifest.json — A2A agent discovery manifest.
- GET /samples — free multi-tier sample manifests (legal + code + matrix).
- GET /metrics — live telemetry (uptime, latency, concurrency).
- GET /pricing.manifest.json — machine-readable pricing.

## Payment protocol

Every paid call requires the x-client-id header (any stable string that
identifies your agent). Without credits the endpoint answers HTTP 402
with a payment-required header carrying a base64 JSON x402 envelope
(x402Version 2, accepts[]: scheme exact, network eip155:137, asset USDC
0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359, payTo treasury). Pay with
any x402 client, or use the built-in pull-payment rail: the gateway
contract 0x2a3D917379Bf94D7B6f239D6BcbBdD7cD8543683 on Polygon PoS
pulls USDC via EIP-712 permit.

Prices: scan-quick $0.05 USDC, scan-deep $0.50 USDC,
structured_data $0.20 USDC, code_modules $1.20 USDC,
legal_code $300/$450/$800 USDC by tier.

## Response envelope

Scan responses carry the machine fields at the top level of data:
{ risk_score, breach_scenarios[], gas_ratio, action }.
All paid responses use the M2M standard envelope:
{ status, payload_id, timestamp, service_type, data, metadata: { node_id,
version, latency_ms, credits_charged } }.
`;

const ROBOTS_TXT = `# Nexus Gateway — AI agents and crawlers welcome.
User-agent: *
Allow: /
Sitemap: https://nexus-m2m-gateway.rakhmadaa.workers.dev/sitemap.xml

# Machine-readable discovery:
# https://nexus-m2m-gateway.rakhmadaa.workers.dev/llms.txt
# https://nexus-m2m-gateway.rakhmadaa.workers.dev/openapi.json
# https://nexus-m2m-gateway.rakhmadaa.workers.dev/pricing.manifest.json
# https://nexus-m2m-gateway.rakhmadaa.workers.dev/manifest.json
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://nexus-m2m-gateway.rakhmadaa.workers.dev/</loc></url>
<url><loc>https://nexus-m2m-gateway.rakhmadaa.workers.dev/pricing</loc></url>
<url><loc>https://nexus-m2m-gateway.rakhmadaa.workers.dev/terms</loc></url>
</urlset>
`;

// ---------- routing ----------

const textResponse = (body, contentType = "text/plain; charset=utf-8") =>
  new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    },
  });

const htmlResponse = (body) =>
  new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    },
  });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight for proxied API calls
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization, x-client-id, X-PAYMENTS-Version, X-PAYMENTS-Response",
          "access-control-max-age": "86400",
        },
      });
    }

    // Discovery pages at domain root (what the x402-list checker probes)
    if (method === "GET") {
      if (path === "/" || path === "/index.html") return htmlResponse(HOMEPAGE);
      if (path === "/llms.txt") return textResponse(LLMS_TXT);
      if (path === "/openapi.json")
        return textResponse(OPENAPI_JSON, "application/json; charset=utf-8");
      if (path === "/pricing" || path === "/pricing.html") return htmlResponse(PRICING);
      if (path === "/robots.txt") return textResponse(ROBOTS_TXT);
      if (path === "/sitemap.xml")
        return textResponse(SITEMAP_XML, "application/xml; charset=utf-8");
      if (path === "/terms" || path === "/terms.html") return htmlResponse(TERMS);
    }

    // Everything else: transparent proxy to the Supabase Edge Function.
    // Method, headers (incl. x-client-id and x402 payment headers), body,
    // and query string are preserved; the response is passed through
    // unmodified (including 402 payment-required headers).
    const upstream = SUPABASE_FUNCTION_URL + url.pathname + url.search;
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete("host");
    proxyHeaders.delete("cf-connecting-ip");
    proxyHeaders.delete("cf-ray");
    proxyHeaders.delete("cf-visitor");
    proxyHeaders.delete("cf-ipcountry");
    proxyHeaders.delete("cf-worker");
    const upstreamResp = await fetch(upstream, {
      method,
      headers: proxyHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
    const respHeaders = new Headers(upstreamResp.headers);
    respHeaders.set("access-control-allow-origin", "*");
    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  },
};

// OpenAPI spec served at the worker root. Server URL points at the worker
// so agents resolve relative paths against the worker (which proxies).
const OPENAPI_JSON = JSON.stringify(
  {
  "openapi": "3.1.0",
  "info": {
    "title": "Nexus Gateway",
    "summary": "EVM Sentinel + M2M legal-code gateway: high-speed static Solidity security scans (honeypot check, drainer detection, 9+2 breach scenarios), bilingual EN/ID legal contract generation, and structured data payloads. Read-only static scan, no wallet approval required. Pay per call in USDC on Polygon PoS via x402 (HTTP 402). No API key; identify with the x-client-id header.",
    "version": "5.0.0",
    "contact": {
      "name": "Nexus Gateway",
      "url": "https://rakhmadaa-gif.github.io/nexus-core-gateway/"
    },
    "x-endpoints-free": [
      "GET /manifest.json",
      "GET /samples",
      "GET /metrics",
      "POST /gateway/dry-run",
      "GET /pricing.manifest.json"
    ]
  },
  "servers": [
    {
      "url": "https://nexus-m2m-gateway.rakhmadaa.workers.dev",
      "description": "Nexus M2M Gateway (Cloudflare Worker front door)"
    }
  ],
  "paths": {
    "/evm-sentinel/v1/scan-quick": {
      "post": {
        "summary": "EVM Sentinel Quick-Check \u2014 honeypot / access-control fast scan",
        "description": "Static rule-engine scan focused on honeypot indicators and access control. Output: { risk_score, breach_scenarios[], gas_ratio, action: ALLOW|BLOCK }. Read-only static scan, no wallet approval required. Cost: $0.05 USDC.",
        "x-pricing": "0.05 USDC per call, x402 exact, eip155:137",
        "x-keywords": [
          "honeypot-check",
          "drainer-detector",
          "risk-gate"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ScanRequest"
              },
              "example": {
                "solidity_code": "contract Token { ... }"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "M2M envelope; data carries { risk_score, breach_scenarios, gas_ratio, action, honeypot_indicators }",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/M2MEnvelope"
                }
              }
            }
          },
          "402": {
            "description": "Payment required (x402 envelope in payment-required header)."
          }
        }
      }
    },
    "/evm-sentinel/v1/scan-deep": {
      "post": {
        "summary": "EVM Sentinel Deep-Scan \u2014 full 9+2 scenario breach analysis",
        "description": "Full static breach analysis: BS-001..BS-009 core scenarios + BS-010 Permit2-drain detection + BS-011 arbitrage-execution manipulation, with per-scenario detail, mitigations, and recommendations. Results cached 1 hour (repeat scans ~50ms). Read-only static scan, no wallet approval required. Cost: $0.50 USDC.",
        "x-pricing": "0.50 USDC per call, x402 exact, eip155:137",
        "x-keywords": [
          "drainer-detector",
          "risk-gate",
          "permit2-drain",
          "arbitrage-manipulation"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ScanRequest"
              },
              "example": {
                "solidity_code": "contract Vault { ... }"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "M2M envelope; data carries { risk_score, breach_scenarios, gas_ratio, action, scenario_detail, permit2_drain, arbitrage_manipulation, recommendations }",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/M2MEnvelope"
                }
              }
            }
          },
          "402": {
            "description": "Payment required (x402 envelope in payment-required header)."
          }
        }
      }
    },
    "/v1/code-modules": {
      "post": {
        "summary": "EVM Sentinel Quick Scan \u2014 audited Solidity code module",
        "description": "Generate a security-audited Solidity contract module (ERC20 / ERC721 / ESCROW) with a 5-point static audit report. Cost: $1.20 USDC.",
        "x-pricing": "1.20 USDC per call, x402 exact, eip155:137",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CodeModulesRequest"
              },
              "example": {
                "service_type": "code_modules",
                "params": {
                  "type": "ERC20",
                  "name": "NexusToken",
                  "symbol": "NEX"
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "M2M success envelope with audited contract source + audit report",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/M2MEnvelope"
                }
              }
            }
          },
          "402": {
            "description": "Payment required. The x402 payment envelope is in the payment-required response header (base64 JSON, x402Version 2, accepts[] with USDC on eip155:137)."
          }
        }
      }
    },
    "/v1/legal-code": {
      "post": {
        "summary": "Hybrid Legal-Code Pro \u2014 bilingual EN/ID legal contract + code mapping",
        "description": "Generate a dual-twin bilingual (English-Indonesian) legal contract mapped to code functions. contract_type: escrow | token_sale. Tiers: light $3.00 / standard $4.50 / enterprise $8.00.",
        "x-pricing": "3.00 / 4.50 / 8.00 USDC per call by params.tier (light/standard/enterprise), x402 exact, eip155:137",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LegalCodeRequest"
              },
              "example": {
                "service_type": "legal_code",
                "params": {
                  "contract_type": "escrow",
                  "tier": "standard",
                  "parties": [
                    "Party A",
                    "Party B"
                  ],
                  "jurisdiction": "ID",
                  "amount": "1000",
                  "currency": "USDC"
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "M2M success envelope with bilingual contract + clause-to-code mapping",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/M2MEnvelope"
                }
              }
            }
          },
          "402": {
            "description": "Payment required (x402 envelope in payment-required header)."
          }
        }
      }
    },
    "/v1/structured-data": {
      "post": {
        "summary": "Verified structured data payload generator",
        "description": "Generate a verified structured JSON payload for Web3, regulatory compliance, or cross-platform orchestration. type: ERC20 | ERC721 | REGULATORY | GENERIC. Cost: $0.20 USDC.",
        "x-pricing": "0.20 USDC per call, x402 exact, eip155:137",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StructuredDataRequest"
              },
              "example": {
                "service_type": "structured_data",
                "params": {
                  "type": "ERC20",
                  "name": "NexusToken",
                  "symbol": "NEX",
                  "decimals": 18
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "M2M success envelope with the verified JSON payload",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/M2MEnvelope"
                }
              }
            }
          },
          "402": {
            "description": "Payment required (x402 envelope in payment-required header)."
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "ScanRequest": {
        "type": "object",
        "required": [
          "solidity_code"
        ],
        "properties": {
          "solidity_code": {
            "type": "string",
            "description": "Full Solidity source code to scan (max 150000 chars)."
          }
        }
      },
      "ScanOutput": {
        "type": "object",
        "description": "Machine scan output: { risk_score: 0.0-1.0, breach_scenarios: string[], gas_ratio: number, action: ALLOW|BLOCK }.",
        "properties": {
          "risk_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "breach_scenarios": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "gas_ratio": {
            "type": "number"
          },
          "action": {
            "type": "string",
            "enum": [
              "ALLOW",
              "BLOCK"
            ]
          }
        }
      },
      "CodeModulesRequest": {
        "type": "object",
        "required": [
          "service_type",
          "params"
        ],
        "properties": {
          "service_type": {
            "const": "code_modules"
          },
          "params": {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "ERC20",
                  "ERC721",
                  "ESCROW"
                ]
              },
              "name": {
                "type": "string",
                "description": "Token name (ERC20/ERC721)"
              },
              "symbol": {
                "type": "string",
                "description": "Token symbol (ERC20/ERC721)"
              }
            }
          }
        }
      },
      "LegalCodeRequest": {
        "type": "object",
        "required": [
          "service_type",
          "params"
        ],
        "properties": {
          "service_type": {
            "const": "legal_code"
          },
          "params": {
            "type": "object",
            "required": [
              "contract_type"
            ],
            "properties": {
              "contract_type": {
                "type": "string",
                "enum": [
                  "escrow",
                  "token_sale"
                ]
              },
              "tier": {
                "type": "string",
                "enum": [
                  "light",
                  "standard",
                  "enterprise"
                ],
                "default": "standard"
              },
              "parties": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "jurisdiction": {
                "type": "string",
                "default": "ID"
              },
              "amount": {
                "type": "string"
              },
              "currency": {
                "type": "string",
                "default": "USDC"
              },
              "deadline": {
                "type": "string"
              }
            }
          }
        }
      },
      "StructuredDataRequest": {
        "type": "object",
        "required": [
          "service_type",
          "params"
        ],
        "properties": {
          "service_type": {
            "const": "structured_data"
          },
          "params": {
            "type": "object",
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "ERC20",
                  "ERC721",
                  "REGULATORY",
                  "GENERIC"
                ]
              },
              "name": {
                "type": "string"
              },
              "symbol": {
                "type": "string"
              },
              "decimals": {
                "type": "integer",
                "default": 18
              },
              "total_supply": {
                "type": "integer"
              }
            }
          }
        }
      },
      "M2MEnvelope": {
        "type": "object",
        "description": "Standard M2M response envelope: { status, payload_id, timestamp, service_type, data, metadata: { node_id, version, latency_ms, credits_charged } }.",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "success",
              "failed"
            ]
          },
          "payload_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          },
          "service_type": {
            "type": "string"
          },
          "data": {
            "type": "object"
          },
          "metadata": {
            "type": "object"
          }
        }
      }
    }
  }
}
);
