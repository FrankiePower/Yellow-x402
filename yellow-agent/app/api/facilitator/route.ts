/**
 * Yellow Facilitator API Route
 * 
 * Provides HTTP endpoints for x402 payment verification and settlement
 * using Yellow Network state channels.
 * 
 * Endpoints:
 * - POST /api/facilitator (body: { action: 'verify' | 'settle', ... })
 * - GET /api/facilitator (health check)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getFacilitator, 
  type VerifyRequest, 
  type SettleRequest 
} from '@/lib/yellow/facilitator/service';

interface FacilitatorRequest {
  action: 'verify' | 'settle';
  payload?: unknown;
  requirements?: unknown;
  seller?: string;
}

/**
 * POST /api/facilitator
 * 
 * Handle verify and settle requests for Yellow x402 payments.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as FacilitatorRequest;
    const facilitator = getFacilitator();

    switch (body.action) {
      case 'verify': {
        const verifyRequest: VerifyRequest = {
          payload: body.payload as VerifyRequest['payload'],
          requirements: body.requirements as VerifyRequest['requirements'],
        };
        
        const result = await facilitator.verify(verifyRequest);
        return NextResponse.json(result);
      }

      case 'settle': {
        const settleRequest: SettleRequest = {
          payload: body.payload as SettleRequest['payload'],
          seller: body.seller as `0x${string}`,
        };
        
        const result = await facilitator.settle(settleRequest);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "verify" or "settle".' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Facilitator] API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/facilitator
 * 
 * Health check endpoint.
 */
export async function GET(): Promise<NextResponse> {
  const facilitator = getFacilitator();
  const health = facilitator.health();
  
  return NextResponse.json({
    service: 'yellow-facilitator',
    ...health,
    timestamp: new Date().toISOString(),
  });
}
