import { NextResponse } from 'next/server';
import { listJurisdictions } from '@/lib/rules/engine';
import { listSeeds } from '@/lib/seed';
import { aiEnabled, modelLabel } from '@/lib/llm/client';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    jurisdictions: listJurisdictions(),
    seeds: listSeeds(),
    aiEnabled: aiEnabled(),
    model: modelLabel(),
    roles: ['applicant', 'architect', 'official'],
  });
}
