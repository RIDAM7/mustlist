---
id: file-uploads/nextjs-s3
title: User file uploads for a Next.js app with Amazon S3
topic: file-uploads
stack: [nextjs, s3, typescript]
summary: >-
  Upload from the browser straight to a private S3 bucket with short-lived
  presigned URLs issued after an auth check. Generate keys and enforce size
  limits server-side, check magic bytes, abort stale multipart uploads, and serve
  files via presigned GET.
status: draft
card_version: 0.1.0
last_verified: null
review_level: null
authors: [RIDAM7]
reviewers: []
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, dashboard, marketplace]
  not_for: [static-assets-in-the-repo, files-generated-only-on-the-server]
related: [auth/nextjs-postgres, rate-limiting/nextjs-postgres]

checklist:
  - id: authorize-before-presign
    lens: security
    level: must
    text: Check the session and the user's right to attach a file to the target record before signing any URL; take the bucket and key from server code, never from the client.
    why: A presigned URL acts with the permissions of the server credentials that signed it.
  - id: server-generated-keys
    lens: security
    level: must
    text: "Generate object keys on the server from random ids (for example `uploads/<userId>/<uuid>`); keep the original filename only in the database."
    why: S3 silently replaces an object with the same key, and user filenames collide and leak into URLs.
  - id: short-expiry
    lens: security
    level: must
    text: Expire upload URLs within minutes (for example 5) and download URLs soon after the download should start; issue a fresh URL instead of a long-lived one.
    why: Presigned URLs are bearer tokens that work repeatedly until they expire.
  - id: enforce-size
    lens: security
    level: must
    text: "Enforce the size limit server-side: `content-length-range` in a presigned POST policy, or for PUT and multipart, check sizes with HeadObject or ListParts before accepting."
    why: A presigned PUT URL alone cannot limit the upload size.
  - id: verify-file-signature
    lens: security
    level: must
    text: Treat the client's Content-Type and extension as hints; after upload, read the first bytes and match the file signature against an allowlist before marking the file ready.
    why: Both the extension and the Content-Type header are set by the client.
  - id: private-bucket
    lens: security
    level: must
    text: Keep the bucket private with all four Block Public Access settings on and ACLs disabled (Bucket owner enforced); serve private files only through short-lived presigned GET URLs.
  - id: no-inline-active-content
    lens: security
    level: must
    text: "Never serve user-uploaded HTML or SVG inline from your app's origin; serve downloads with `Content-Disposition: attachment` from the storage or a separate CDN domain."
    why: Inline HTML or SVG on your origin runs its scripts as your app (stored XSS).
  - id: strict-cors
    lens: security
    level: must
    text: "Limit bucket CORS to your exact app origins and the methods you use (PUT or POST to upload, GET to download); expose `ETag` if the browser runs multipart uploads."
  - id: scan-shared-files
    lens: security
    level: should
    text: Scan files that other users or staff will open for malware, and keep them unavailable until the scan passes.
  - id: least-privilege-signer
    lens: security
    level: should
    text: Sign URLs with an IAM role limited to the upload prefix and to s3:PutObject and s3:GetObject; prefer short-lived role credentials over long-lived access keys.
    why: A presigned URL can do only what its signer is allowed to do.
  - id: direct-to-s3
    lens: performance
    level: must
    text: Send file bytes from the browser straight to S3; use Server Actions and Route Handlers only to sign URLs and confirm uploads.
    why: Server Actions accept 1 MB bodies by default, and serverless hosts cap request bodies.
  - id: multipart-large-files
    lens: performance
    level: should
    text: Use multipart upload with presigned part URLs for files over about 100 MB, uploading parts in parallel and retrying only the failed parts.
    why: A single PUT is capped at 5 GB, and AWS suggests multipart from about 100 MB.
  - id: cleanup-incomplete-uploads
    lens: cost
    level: must
    text: Add a lifecycle rule that aborts incomplete multipart uploads (for example after 7 days), and a job that deletes objects whose rows stay pending (for example after 24 hours).
    why: Parts of unfinished multipart uploads are billed until the upload is completed or aborted.
  - id: file-metadata-row
    lens: data
    level: must
    text: Store a row per file (owner, key, original name, size, detected type, status); insert it as pending before signing and mark it ready only after the server checks pass.
  - id: upload-feedback
    lens: ux
    level: should
    text: Check size and type in the browser before requesting a URL, show progress, and let users cancel and retry failed uploads.

decisions:
  - id: max-file-size
    question: How large can a single uploaded file be?
    options:
      - { id: under-10mb, label: "Under 10 MB (avatars, documents)" }
      - { id: up-to-100mb, label: "10 MB to 100 MB" }
      - { id: over-100mb, label: "Over 100 MB (video, archives)", points_to: presigned-direct }
    default: under-10mb
  - id: file-kinds
    question: Which file types will you accept?
    options:
      - { id: images-only, label: "Images only (JPEG, PNG, WebP)" }
      - { id: documents, label: "Images and documents (PDF, office files)" }
      - { id: any-type, label: "Any file type" }
    default: images-only
  - id: visibility
    question: Who should be able to download an uploaded file?
    options:
      - { id: owner-or-team, label: "Only the uploader or their team" }
      - { id: public-assets, label: "Anyone with the link (public assets such as avatars)" }
    default: owner-or-team
  - id: storage-provider
    question: Where will the files be stored?
    options:
      - { id: aws-s3, label: "Amazon S3", points_to: presigned-direct }
      - { id: s3-compatible, label: "Another S3-compatible provider", points_to: s3-compatible }
      - { id: managed, label: "A managed upload service", points_to: managed-upload-service }
    default: aws-s3
  - id: shared-files
    question: Will other users or your staff open files that someone else uploaded?
    options:
      - { id: shared, label: "Files are shared or reviewed by others" }
      - { id: uploader-only, label: "Only the uploader opens their files" }
    default: shared

options:
  - id: presigned-direct
    name: Presigned direct-to-S3 uploads (POST, PUT or multipart)
    best_fit_when:
      - You use Amazon S3 and want file bytes never to pass through your servers
      - You need large files or many concurrent uploads
      - You want to own storage, keys and access rules in your AWS account
    avoid_when:
      - You need an upload widget, image transforms and scanning with no backend work
    tradeoffs:
      - You own CORS, lifecycle rules, validation and cleanup jobs
      - Browser multipart uploads need more client code
  - id: s3-compatible
    name: Presigned uploads to an S3-compatible provider
    examples: [Cloudflare R2, Backblaze B2, MinIO]
    best_fit_when:
      - Download (egress) cost dominates your storage bill
      - You self-host storage or need a specific provider or region
    avoid_when:
      - You rely on S3 features your provider lacks, such as POST policies, event notifications or native malware scanning
    tradeoffs:
      - Feature support varies; check presigned POST, CORS, lifecycle rules and checksum support
      - The SDK client needs a custom endpoint and sometimes path-style addressing
  - id: managed-upload-service
    name: Managed upload service
    examples: [UploadThing, Uploadcare, Cloudinary, Vercel Blob]
    best_fit_when:
      - You want upload UI, resumable uploads and image transforms out of the box
      - A small team does not want to own storage security
    avoid_when:
      - Per-GB or per-upload pricing hurts at your expected volume
      - Files must stay in your own cloud account
    tradeoffs:
      - Vendor lock-in for file URLs and SDKs
      - You still authorize uploads and keep file metadata in your database
  - id: server-proxy
    name: Proxy uploads through a Server Action or Route Handler
    best_fit_when:
      - Files are small (under the 1 MB Server Action default) and must be transformed before storage
    avoid_when:
      - Files can exceed your host's request body limit (for example 4.5 MB on Vercel Functions)
      - Uploads are large or frequent
    tradeoffs:
      - Every byte costs server bandwidth, memory and function time
      - Raising bodySizeLimit widens the denial-of-service surface
recommended: presigned-direct

versions:
  - package: next
    range: ">=16.0.0"
    notes:
      - "Server Action request bodies are capped at 1 MB by default (`experimental.serverActions.bodySizeLimit`); send file bytes to S3, not to an action."
      - "`proxy.ts` buffers request bodies only up to `experimental.proxyClientMaxBodySize` (default 10 MB, renamed from `middlewareClientMaxBodySize`); larger bodies arrive truncated, and Next.js only logs a warning."
      - "`next/image` keeps optimized images for at least `images.minimumCacheTTL` (4 hours by default in v16) with no invalidation; don't optimize presigned URLs of private files."
      - "Restrict `images.remotePatterns` to your bucket or CDN host and path; the optimizer rejects SVG unless `dangerouslyAllowSVG` is set."
    docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions
    context7: https://context7.com/vercel/next.js
  - package: "@aws-sdk/client-s3"
    range: ">=3.0.0 <4.0.0"
    notes:
      - "Use the modular v3 clients (`S3Client` plus `client.send(command)`); the v2 `aws-sdk` package reached end of support in September 2025."
      - "Since about 3.729.0 the client adds CRC32 checksums by default (`requestChecksumCalculation: 'WHEN_SUPPORTED'`); if presigned PUTs or an S3-compatible provider fail, set `'WHEN_REQUIRED'`."
      - "Current 3.x releases require Node.js 20 or later."
      - "For S3-compatible providers set `endpoint`, and `forcePathStyle: true` if the provider needs path-style URLs."
    docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
    context7: https://context7.com/aws/aws-sdk-js-v3
  - package: "@aws-sdk/s3-request-presigner"
    range: ">=3.0.0 <4.0.0"
    notes:
      - "`getSignedUrl(client, command, { expiresIn })` defaults to 900 seconds; SigV4 URLs last at most 7 days and die early if the signing credentials expire."
      - "Content-Type is not signed by default; pass `signableHeaders: new Set(['content-type'])` so the browser must send the type you approved."
      - "To sign `x-amz-*` headers (for example a checksum), list them in `unhoistableHeaders`; the browser must then send them."
      - "A presigned PUT cannot enforce a size range; check the size after upload, or use a presigned POST."
    docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/
    context7: https://context7.com/aws/aws-sdk-js-v3
  - package: "@aws-sdk/s3-presigned-post"
    range: ">=3.0.0 <4.0.0"
    notes:
      - "`createPresignedPost` returns `{ url, fields }`; the browser posts every field, then the file as the last form field."
      - "Add `['content-length-range', min, max]` to `Conditions` so S3 rejects files outside the range."
      - "Values required by `Conditions` (for example `Content-Type`) must also be set in `Fields`; the SDK does not copy them."
      - "`Expires` defaults to 3600 seconds; set a few minutes instead."
    docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-presigned-post/
    context7: https://context7.com/aws/aws-sdk-js-v3

verify:
  - id: presign-requires-auth
    lens: security
    type: integration
    check: Requesting an upload URL without a session, or for a record the user cannot edit, returns 401/403 and no URL.
  - id: key-ignores-filename
    lens: security
    type: unit
    check: The generated object key contains no part of the client's filename and differs on every call, even for the same filename.
  - id: size-limit-enforced
    lens: security
    type: integration
    check: A file one byte over the limit is rejected by S3 (POST policy) or by the confirm step, which deletes the object; the file never becomes ready.
  - id: spoofed-type-rejected
    lens: security
    type: integration
    check: A file named photo.png sent with Content-Type image/png but containing HTML is rejected at the confirm step.
  - id: bucket-private
    lens: security
    type: manual
    check: An unsigned request for an object returns 403, and the bucket has all four Block Public Access settings on and ACLs disabled.
  - id: urls-expire
    lens: security
    type: integration
    check: Upload and download URLs return 403 after their expiry time.
  - id: cors-origins
    lens: security
    type: e2e
    check: A browser upload from the app origin succeeds, and the CORS preflight from an unlisted origin fails.
  - id: download-attachment
    lens: security
    type: integration
    check: "Presigned download URLs for non-image files return Content-Disposition: attachment."
  - id: no-file-bytes-to-next
    lens: performance
    type: integration
    check: No request to the Next.js app during an upload carries the file bytes; each is a few KB at most.
  - id: abort-rule-present
    lens: cost
    type: manual
    check: The bucket lifecycle configuration contains an AbortIncompleteMultipartUpload rule.
  - id: pending-cleanup
    lens: data
    type: integration
    check: An upload that is never confirmed has its row and object removed by the cleanup job after the configured age.

sources:
  - { title: "Amazon S3: Download and upload objects with presigned URLs", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html" }
  - { title: "Amazon S3: Uploading objects with presigned URLs", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html" }
  - { title: "Amazon S3: POST policy (content-length-range)", url: "https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html" }
  - { title: "Amazon S3: Uploading objects (single PUT up to 5 GB)", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html" }
  - { title: "Amazon S3: Multipart upload limits", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html" }
  - { title: "Amazon S3: Uploading and copying objects using multipart upload", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html" }
  - { title: "Amazon S3: Lifecycle rule to delete incomplete multipart uploads", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html" }
  - { title: "Amazon S3: Blocking public access", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html" }
  - { title: "Amazon S3: Object Ownership and disabling ACLs", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html" }
  - { title: "Amazon S3: Elements of a CORS configuration", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html" }
  - { title: "Amazon S3 API: GetObject (response header overrides)", url: "https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html" }
  - { title: "Amazon GuardDuty: Malware Protection for S3", url: "https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html" }
  - { title: "AWS SDKs: Data integrity protections for Amazon S3", url: "https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html" }
  - { title: "AWS: End of support for AWS SDK for JavaScript v2", url: "https://aws.amazon.com/blogs/developer/announcing-end-of-support-for-aws-sdk-for-javascript-v2/" }
  - { title: "Amazon S3 pricing", url: "https://aws.amazon.com/s3/pricing/" }
  - { title: OWASP File Upload Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html" }
  - { title: "Next.js: serverActions config (bodySizeLimit)", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions" }
  - { title: "Next.js: proxyClientMaxBodySize", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize" }
  - { title: "Next.js: Image component (minimumCacheTTL, dangerouslyAllowSVG)", url: "https://nextjs.org/docs/app/api-reference/components/image" }
  - { title: "Next.js: Backend for Frontend guide (user-generated assets)", url: "https://nextjs.org/docs/app/guides/backend-for-frontend" }
  - { title: "Vercel Functions limits (request body size)", url: "https://vercel.com/docs/functions/limitations" }
  - { title: "MDN: Content-Disposition", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition" }
  - { title: "MDN: Access-Control-Expose-Headers", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers" }
---

## Why this approach

Presigned URLs let the browser send file bytes straight to S3, so your Next.js server only authorizes the upload, picks the object key and records metadata; it never buffers files or runs into the 1 MB Server Action limit or a host's request size cap. The bucket stays private, and every upload or download is a short-lived grant for one object that you issue after an auth check. Prefer a presigned POST when S3 itself must enforce a size range; use presigned PUT or multipart for large files and check the size after upload. Choose an S3-compatible provider when egress cost dominates, a managed upload service when you want widgets and transforms without backend work, and server proxying only for small files you must transform first.

## Lenses

### Security

Authorize first: check the session and the user's right to attach a file to the target record in the Server Action or Route Handler that signs the URL, and rate-limit it per user. Generate the key on the server, sign one operation for one key, and keep expiry short, because a presigned URL works for anyone who holds it until it expires. Sign with an IAM role scoped to the upload prefix. The client's Content-Type and extension are claims, not facts: after upload, read the first bytes with a ranged GetObject, match the file signature against your allowlist, and re-encode images you display. Keep all four Block Public Access settings on and ACLs disabled. Never stream user-uploaded HTML or SVG inline through a Route Handler on your app's domain; that turns an upload into stored XSS. Set `response-content-disposition` on presigned GETs for anything that isn't a safe image type. Scan files that other people will open, and hide them until the scan passes.

### Performance & latency

Presigning is computed locally and makes no S3 request, so sign in the same action that inserts the pending row. Keep file bytes out of Server Actions and Route Handlers: they add a second full transfer and hold a function open. Use multipart upload from about 100 MB: parts are 5 MiB to 5 GiB, up to 10,000 per upload, and can be sent in parallel and retried one at a time; a single PUT is limited to 5 GB. For images, create fixed-size thumbnails after upload or put a CDN in front of public files. Avoid running presigned URLs through `next/image`: every signature is a new cache key, so you get cache misses, and cached copies can outlive the URL.

### UX flows

Check size and type in the browser before asking for a URL, so users get instant, specific errors ("Up to 10 MB: JPEG, PNG or WebP"). Show per-file progress, allow cancel, and retry failed files or parts without restarting the batch. After the upload finishes, call a confirm action that runs the server checks; show the file as "processing" until checks and scans pass. Explain rejections plainly: too large, unsupported type, or failed scan. When a URL has expired, request a new one automatically. Name downloads after the original filename with `Content-Disposition`, escaped safely.

### Data model

Keep one row per file: `id`, `owner_id` and the record it belongs to, a unique `storage_key`, `original_name`, `content_type` (as detected, not as claimed), `size_bytes`, `status` (`pending`, `ready`, `rejected`) and `created_at`. Insert the row as `pending` before signing, and set it to `ready` only after the confirm step has checked size and file signature. Index `owner_id`, plus `(status, created_at)` for the cleanup job. Authorize downloads by looking up the row, never by trusting a key the client sends. Delete the S3 object when its row is deleted, and decide retention up front, for example removing files of deleted accounts within 30 days.

### Cost

S3 charges for storage, requests and data transferred out to the internet, so heavy downloads often cost more than storage; put a CDN in front of popular public files. Parts of unfinished multipart uploads are billed until the upload is completed or aborted, which makes the `AbortIncompleteMultipartUpload` lifecycle rule essential. Unconfirmed `pending` uploads cost storage until a job deletes them. Providers with low or no egress fees can cut download-heavy bills. Managed upload services charge per GB or per upload, so estimate the bill at ten times your launch volume. Proxying uploads through serverless functions adds compute time for every byte.

## Common mistakes

- Sending file bytes through a Server Action or Route Handler and raising `bodySizeLimit` until large files fit.
- Using the user's filename as the object key, which overwrites other files and leaks names into URLs.
- Issuing presigned URLs without checking who is asking or which record the file belongs to.
- Trusting `file.type` or the extension instead of checking the file signature after upload.
- A presigned PUT with no size check, so a "10 MB avatar" endpoint accepts a 5 GB file.
- Making the bucket public "just to show images", or presigned URLs that last for days.
- CORS that allows every origin and method, or omits `ETag` from `ExposeHeaders` when the browser runs multipart uploads.
- Serving uploaded SVG or HTML inline from the app's own domain.
- No lifecycle rule for incomplete multipart uploads and no cleanup of unconfirmed uploads.
- Marking a file ready because the client says the upload finished, without a server-side HeadObject check.

## Notes for reviewers

Check these claims against the sources before setting `verified`:
- Whether presigned PUTs from SDK 3.x still embed a CRC32 checksum by default and fail without `requestChecksumCalculation: 'WHEN_REQUIRED'` (test against S3 and one S3-compatible provider), and that the default changed in about 3.729.0.
- That `getSignedUrl` leaves `content-type` unsigned unless it is in `signableHeaders` (seen in the 3.1169.0 source), and that presigning makes no network call to S3.
- The S3 limits: 5 GB per single PUT, 5 MiB to 5 GiB per part, 10,000 parts, and the new 48.8 TiB (50 TB) maximum object size.
- The Next.js 16.4 defaults: 1 MB Server Action body limit, 10 MB `proxyClientMaxBodySize` (still experimental), 4 hour `minimumCacheTTL`.
- The 4.5 MB Vercel Functions request body limit (host-specific; other hosts differ).
- Presigned POST, CORS and lifecycle support for the providers in `options.examples`.
- That the docs and Context7 links resolve.
