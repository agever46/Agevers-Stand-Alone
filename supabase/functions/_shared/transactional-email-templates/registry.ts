import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as purchaseConfirmation } from './purchase-confirmation.tsx'
import { template as codeViewedConfirmation } from './code-viewed-confirmation.tsx'
import { template as adminNewOrder } from './admin-new-order.tsx'
import { template as emailVerification } from './email-verification.tsx'
import { template as emailVerificationReminder } from './email-verification-reminder.tsx'
import { template as liveSupportRequest } from './live-support-request.tsx'
import { template as adminNewSignup } from './admin-new-signup.tsx'
import { template as adminSearchSummary } from './admin-search-summary.tsx'
import { template as wishlistAlert } from './wishlist-alert.tsx'
import { template as cartAbandonment } from './cart-abandonment.tsx'
import { template as giveawayWinner } from './giveaway-winner.tsx'
import { template as giveawayLoser } from './giveaway-loser.tsx'
import { template as orderCancelledSecurity } from './order-cancelled-security.tsx'
import { template as orderUnderReview } from './order-under-review.tsx'
import { template as orderVerificationRequired } from './order-verification-required.tsx'
import { template as accountBlocked } from './account-blocked.tsx'
import { template as accountUnblocked } from './account-unblocked.tsx'
import { template as coolingPeriodEnded } from './cooling-period-ended.tsx'
import { template as newAccountLimitBlocked } from './new-account-limit-blocked.tsx'
import { template as liveChatInvite } from './live-chat-invite.tsx'
import { template as liveChatNewMessage } from './live-chat-new-message.tsx'
import { template as orderCancelledCooling24h } from './order-cancelled-cooling-24h.tsx'
import { template as passwordResetFixed } from './password-reset-fixed.tsx'
import { template as giveawayManualDelivery } from './giveaway-manual-delivery.tsx'
import { template as dailyDealsNewsletter } from './daily-deals-newsletter.tsx'
import { template as smsRegionIssue } from './sms-region-issue.tsx'
import { template as smsRegionFixed } from './sms-region-fixed.tsx'
import { template as orderApprovedCodeReady } from './order-approved-code-ready.tsx'
import { template as purchaseOtpEmail } from './purchase-otp-email.tsx'
import { template as reviewRequestTrustpilot } from './review-request-trustpilot.tsx'
import { template as reviewRewardVoucher } from './review-reward-voucher.tsx'
import { template as codeRevealReminder } from './code-reveal-reminder.tsx'
import { template as contactFormMessage } from './contact-form-message.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'purchase-confirmation': purchaseConfirmation,
  'code-viewed-confirmation': codeViewedConfirmation,
  'admin-new-order': adminNewOrder,
  'email-verification': emailVerification,
  'email-verification-reminder': emailVerificationReminder,
  'live-support-request': liveSupportRequest,
  'admin-new-signup': adminNewSignup,
  'admin-search-summary': adminSearchSummary,
  'wishlist-alert': wishlistAlert,
  'cart-abandonment': cartAbandonment,
  'giveaway-winner': giveawayWinner,
  'giveaway-loser': giveawayLoser,
  'order-cancelled-security': orderCancelledSecurity,
  'order-under-review': orderUnderReview,
  'order-verification-required': orderVerificationRequired,
  'account-blocked': accountBlocked,
  'account-unblocked': accountUnblocked,
  'cooling-period-ended': coolingPeriodEnded,
  'new-account-limit-blocked': newAccountLimitBlocked,
  'live-chat-invite': liveChatInvite,
  'live-chat-new-message': liveChatNewMessage,
  'order-cancelled-cooling-24h': orderCancelledCooling24h,
  'password-reset-fixed': passwordResetFixed,
  'giveaway-manual-delivery': giveawayManualDelivery,
  'daily-deals-newsletter': dailyDealsNewsletter,
  'sms-region-issue': smsRegionIssue,
  'sms-region-fixed': smsRegionFixed,
  'order-approved-code-ready': orderApprovedCodeReady,
  'purchase-otp-email': purchaseOtpEmail,
  'review-request-trustpilot': reviewRequestTrustpilot,
  'review-reward-voucher': reviewRewardVoucher,
  'code-reveal-reminder': codeRevealReminder,
  'contact-form-message': contactFormMessage,
}
