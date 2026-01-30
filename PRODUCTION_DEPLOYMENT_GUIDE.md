# Production Deployment Guide - Zalo Mini App Traceability System

## 📋 Pre-Deployment Checklist

### ✅ Phase 1: Infrastructure Setup (Week 1)

#### 1.1 Supabase Production Database
- [ ] Create production Supabase project
- [ ] Run all SQL migrations in order (001 → 020)
  \`\`\`bash
  # Execute in Supabase SQL Editor
  scripts/001-create-epcis-schema.sql
  scripts/002-enhance-master-data.sql
  # ... continue with all scripts
  scripts/020-iot-devices-system.sql
  \`\`\`
- [ ] Verify all tables created correctly
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create production service role key
- [ ] Set up database backups (daily)

#### 1.2 Environment Variables
\`\`\`bash
# Main App (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyxxx...

# Zalo Mini App (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
ZALO_APP_ID=xxx
ZALO_APP_SECRET=xxx
JWT_SECRET=your-secure-random-string-here
\`\`\`

#### 1.3 Supabase Edge Functions
- [ ] Deploy `process-vision-input` function
  \`\`\`bash
  supabase functions deploy process-vision-input
  \`\`\`
- [ ] Deploy `process-voice-input` function
  \`\`\`bash
  supabase functions deploy process-voice-input
  \`\`\`
- [ ] Set function secrets
  \`\`\`bash
  supabase secrets set GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyxxx...
  \`\`\`
- [ ] Test functions with sample data
- [ ] Monitor function logs for errors

---

### ✅ Phase 2: Zalo Mini App Registration (Week 2)

#### 2.1 Zalo Developer Account
- [ ] Create Zalo Developer account at https://developers.zalo.me
- [ ] Register new Mini App
- [ ] Get App ID and App Secret
- [ ] Configure OAuth callback URLs

#### 2.2 App Configuration
- [ ] Update `zalo-mini-app/app-config.json`
  \`\`\`json
  {
    "app": {
      "appId": "YOUR_ZALO_APP_ID",
      "appName": "Traceability System"
    }
  }
  \`\`\`
- [ ] Configure permissions (camera, microphone, location)
- [ ] Set up testing environment
- [ ] Add test users for internal testing

#### 2.3 Build & Package
\`\`\`bash
cd zalo-mini-app
npm install
npm run build

# Package for Zalo
zip -r traceability-app.zip dist/
\`\`\`
- [ ] Upload to Zalo Developer Console
- [ ] Submit for Zalo review
- [ ] Wait for approval (3-7 days)

---

### ✅ Phase 3: Data Migration & Seeding (Week 2)

#### 3.1 Master Data
- [ ] Import products (CSV/Excel)
  \`\`\`sql
  COPY products(gtin, name, description, category)
  FROM '/path/to/products.csv'
  WITH (FORMAT csv, HEADER true);
  \`\`\`
- [ ] Import locations with GLN codes
- [ ] Import business partners
- [ ] Import user accounts with roles

#### 3.2 Sample Data for Testing
- [ ] Run seed script: `scripts/005-seed-data.sql`
- [ ] Create test batches
- [ ] Generate sample events
- [ ] Verify traceability chains work

#### 3.3 User Training Data
- [ ] Create user accounts for field workers
- [ ] Assign roles (farmer, processor, quality_control)
- [ ] Assign locations to users
- [ ] Test authentication flow

---

### ✅ Phase 4: Security Hardening (Week 3)

#### 4.1 Authentication & Authorization
- [ ] Enable Supabase Auth for main app
- [ ] Implement JWT token exchange for Zalo
  - API endpoint: `/api/auth/zalo-exchange`
- [ ] Test RLS policies with different user roles
- [ ] Enable MFA for admin accounts
- [ ] Set session timeout (24 hours)

#### 4.2 API Security
- [ ] Enable CORS for allowed origins only
- [ ] Add rate limiting (180 req/min per IP)
  \`\`\`typescript
  // Already implemented in lib/rate-limit.ts
  \`\`\`
- [ ] Implement API key validation
- [ ] Add request logging for audit trail
- [ ] Enable HTTPS only (no HTTP)

#### 4.3 Data Security
- [ ] Encrypt sensitive fields in database
- [ ] Mask personal data in logs
- [ ] Set up database connection pooling
- [ ] Enable SSL for database connections
- [ ] Configure backup encryption

---

### ✅ Phase 5: Performance Optimization (Week 3)

#### 5.1 Database Optimization
- [ ] Verify all indexes created (script 012)
- [ ] Enable connection pooling (Supavisor)
- [ ] Set up read replicas for analytics
- [ ] Configure statement timeout (30s)
- [ ] Enable query plan caching

#### 5.2 Edge Functions Optimization
- [ ] Configure memory limits (512MB)
- [ ] Set timeout to 60 seconds
- [ ] Enable function logs
- [ ] Monitor cold start times
- [ ] Add caching for frequently called data

#### 5.3 Frontend Optimization
- [ ] Enable Next.js production build
  \`\`\`bash
  npm run build
  \`\`\`
- [ ] Configure CDN for static assets
- [ ] Enable image optimization
- [ ] Add service worker for offline mode
- [ ] Compress API responses (gzip)

---

### ✅ Phase 6: Monitoring & Alerts (Week 4)

#### 6.1 Supabase Monitoring
- [ ] Enable Database Insights
- [ ] Set up alerts for:
  - High CPU usage (>80%)
  - High memory usage (>85%)
  - Slow queries (>1s)
  - Failed RLS checks
  - Edge function errors

#### 6.2 Application Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Configure logging (Winston/Pino)
- [ ] Add performance monitoring
- [ ] Track key metrics:
  - Events created per hour
  - AI processing success rate
  - Offline queue sync rate
  - Transformation event count

#### 6.3 Business Metrics
- [ ] Track active users daily
- [ ] Monitor event creation rate
- [ ] Track mass balance violations
- [ ] Generate weekly analytics reports

---

### ✅ Phase 7: Testing (Week 4)

#### 7.1 Integration Testing
- [ ] Test voice input → Gemini → EPCIS creation
- [ ] Test vision input → Gemini → EPCIS creation
- [ ] Test batch operations
- [ ] Test transformation events
- [ ] Test offline mode & sync
- [ ] Test traceability queries (forward/backward)

#### 7.2 Load Testing
\`\`\`bash
# Run load tests
cd scripts
node load-test-suite.js
\`\`\`
- [ ] Test 100 concurrent users
- [ ] Test 1000 events per hour
- [ ] Verify response times <500ms
- [ ] Test database connection limits
- [ ] Test Edge function concurrency

#### 7.3 User Acceptance Testing
- [ ] Test with 5-10 real users
- [ ] Collect feedback on UI/UX
- [ ] Test on different devices (iOS/Android)
- [ ] Test in poor network conditions
- [ ] Verify offline mode works

---

### ✅ Phase 8: Documentation (Week 5)

#### 8.1 User Documentation
- [ ] Create user manual (Vietnamese)
- [ ] Create video tutorials:
  - How to record voice events
  - How to capture photos
  - How to create batch operations
  - How to view traceability
- [ ] Create FAQ document
- [ ] Create troubleshooting guide

#### 8.2 Technical Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema documentation
- [ ] Deployment runbook
- [ ] Disaster recovery plan
- [ ] Security incident response plan

#### 8.3 Training Materials
- [ ] Field worker training slides
- [ ] Admin dashboard training
- [ ] Quality control procedures
- [ ] Compliance audit procedures

---

### ✅ Phase 9: Go-Live Preparation (Week 5-6)

#### 9.1 Soft Launch
- [ ] Deploy to staging environment
- [ ] Invite 20-30 pilot users
- [ ] Monitor for 1 week
- [ ] Collect feedback
- [ ] Fix critical bugs

#### 9.2 Final Deployment
- [ ] Schedule maintenance window
- [ ] Deploy main app to Vercel
  \`\`\`bash
  vercel --prod
  \`\`\`
- [ ] Submit Zalo Mini App for production
- [ ] Update DNS records
- [ ] Enable monitoring alerts
- [ ] Notify users of go-live

#### 9.3 Post-Launch
- [ ] Monitor system for 48 hours continuously
- [ ] Have support team ready
- [ ] Prepare rollback plan
- [ ] Send launch announcement
- [ ] Celebrate! 🎉

---

## 🚨 Critical Dependencies

### Required Services
1. **Supabase** (Database + Edge Functions)
   - Plan: Pro ($25/month minimum)
   - Storage: 8GB minimum
   - Functions: 2 million invocations/month

2. **Google Gemini API** (AI Processing)
   - Free tier: 1500 requests/day
   - Paid tier: $0.00035 per image
   - Vietnamese support: ✅

3. **Zalo Mini App** (Mobile Platform)
   - Cost: Free
   - Review time: 3-7 days
   - Requirements: Business license

4. **Vercel** (Main App Hosting)
   - Plan: Pro ($20/month)
   - Functions: 1000 GB-hours

### Total Monthly Cost Estimate
- Supabase: $25
- Vercel: $20
- Gemini API: ~$50 (for 5000 events/month)
- **Total: ~$95/month**

---

## 📊 Success Metrics

### Week 1-2
- [ ] 50+ events created
- [ ] 10+ active users
- [ ] 95%+ AI extraction accuracy

### Month 1
- [ ] 500+ events created
- [ ] 50+ active users
- [ ] <2% mass balance violations
- [ ] 99.5% uptime

### Month 3
- [ ] 2000+ events created
- [ ] 100+ active users
- [ ] Full supply chain visibility
- [ ] Zero security incidents

---

## 🆘 Emergency Contacts

- **Supabase Support**: support@supabase.com
- **Vercel Support**: support@vercel.com
- **Zalo Support**: developers.zalo.me/support

---

## 📝 Rollback Plan

If critical issues occur post-deployment:

1. **Database Rollback**
   \`\`\`sql
   -- Restore from backup
   pg_restore -d production backup_YYYYMMDD.dump
   \`\`\`

2. **Application Rollback**
   \`\`\`bash
   # Revert to previous Vercel deployment
   vercel rollback
   \`\`\`

3. **Edge Functions Rollback**
   \`\`\`bash
   # Redeploy previous version
   supabase functions deploy process-vision-input --version v1.0.0
   \`\`\`

---

## ✅ Final Sign-Off

- [ ] Technical Lead approval
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] User training completed
- [ ] Documentation finalized
- [ ] Backup & recovery tested
- [ ] Monitoring configured
- [ ] Support team briefed

**Deployment Date**: _______________
**Deployed By**: _______________
**Approved By**: _______________
