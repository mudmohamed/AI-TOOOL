import { RecoveryStep, RecoveryStrategy, RiskConfig } from '../types';

/**
 * Calculates the next trade stake based on selected risk recovery protocol.
 */
export function calculateNextStake(
  baseStake: number,
  cumulativeLoss: number,
  consecutiveLosses: number,
  payoutRate: number, // decimal e.g. 0.95 for 95%, 9.5 for 950% (matches)
  strategy: RecoveryStrategy
): number {
  if (consecutiveLosses === 0 || cumulativeLoss <= 0) {
    return Number(baseStake.toFixed(2));
  }

  // Net payout rate = (Total payout multiplier - 1)
  // E.g. if payout is 1.95, net rate is 0.95. If payout is 9.5 (matches), net rate is 8.5.
  // If payoutRate is already passed as net profit percentage:
  const netRate = payoutRate > 1.5 ? payoutRate - 1 : payoutRate;
  const safeNetRate = Math.max(0.08, netRate);

  let nextStake = baseStake;

  switch (strategy) {
    case 'X2_SUPER_RECOVERY': {
      // Recovers 100% of the lost capital PLUS locks in 2x base profit
      const targetProfit = baseStake * 2;
      nextStake = (cumulativeLoss + targetProfit) / safeNetRate;
      break;
    }

    case 'X4_SUPER_RECOVERY': {
      // Super Recovery X4: Recovers 100% of lost capital PLUS locks in 4x base profit
      const targetProfit = baseStake * 4;
      nextStake = (cumulativeLoss + targetProfit) / safeNetRate;
      break;
    }

    case 'MARTINGALE': {
      // Classic Martingale stake doubling per loss
      nextStake = baseStake * Math.pow(2, consecutiveLosses);
      break;
    }

    case 'DALEMBERT': {
      // D'Alembert: Increases stake linearly by 1 base unit per loss
      nextStake = baseStake * (1 + consecutiveLosses * 0.8);
      break;
    }

    default:
      nextStake = baseStake;
  }

  // Ensure minimum stake of 0.35 (standard Deriv min stake is $0.35 - $0.50)
  return Math.max(0.35, Number(nextStake.toFixed(2)));
}

/**
 * Generates full step-by-step recovery ladder for transparent risk forecasting
 */
export function generateRecoveryLadder(
  config: RiskConfig,
  maxSteps: number = 8
): RecoveryStep[] {
  const steps: RecoveryStep[] = [];
  let cumulativeLoss = 0;
  const netRate = config.payoutRate > 1.5 ? config.payoutRate - 1 : config.payoutRate;
  const safeNetRate = Math.max(0.08, netRate);

  for (let i = 1; i <= maxSteps; i++) {
    let stake = config.baseStake;

    if (i > 1) {
      stake = calculateNextStake(
        config.baseStake,
        cumulativeLoss,
        i - 1,
        config.payoutRate,
        config.recoveryStrategy
      );
    }

    const totalAtRisk = Number((cumulativeLoss + stake).toFixed(2));
    const grossPayout = Number((stake * (1 + safeNetRate)).toFixed(2));
    const netProfitOnWin = Number((stake * safeNetRate - cumulativeLoss).toFixed(2));
    const recoveryRatio = cumulativeLoss > 0
      ? Number(((netProfitOnWin / cumulativeLoss) * 100).toFixed(1))
      : 100;

    let riskGrade: RecoveryStep['riskGrade'] = 'LOW';
    if (totalAtRisk > config.stopLoss * 0.8) {
      riskGrade = 'CRITICAL';
    } else if (totalAtRisk > config.stopLoss * 0.5) {
      riskGrade = 'HIGH';
    } else if (i >= 4) {
      riskGrade = 'ELEVATED';
    } else if (i >= 2) {
      riskGrade = 'MODERATE';
    }

    steps.push({
      step: i,
      stake,
      cumulativeLoss,
      totalAtRisk,
      payoutOnWin: grossPayout,
      netProfitOnWin,
      recoveryRatio,
      riskGrade,
    });

    cumulativeLoss += stake;
  }

  return steps;
}

/**
 * Standard contract default payouts on Deriv
 */
export const CONTRACT_PAYOUT_PRESETS: Record<string, { label: string; payoutRate: number; defaultTarget: string }> = {
  MATCHES: {
    label: 'Matches (Exact Digit 0-9)',
    payoutRate: 9.5, // 950% gross payout (850% net profit)
    defaultTarget: '0',
  },
  DIFFERS: {
    label: 'Differs (Any Other Digit)',
    payoutRate: 1.09, // ~9-10% net profit, ~90-95% win probability
    defaultTarget: '5',
  },
  OVER: {
    label: 'Over (Digit > Target)',
    payoutRate: 1.45, // ~45% net profit depending on target
    defaultTarget: '2',
  },
  UNDER: {
    label: 'Under (Digit < Target)',
    payoutRate: 1.45,
    defaultTarget: '7',
  },
  RISE: {
    label: 'Rise / Higher',
    payoutRate: 1.95, // 95% net profit
    defaultTarget: 'Higher',
  },
  FALL: {
    label: 'Fall / Lower',
    payoutRate: 1.95,
    defaultTarget: 'Lower',
  },
};
