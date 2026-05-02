'use client'

import { RatingScalePage } from '@/features/settings/rating-scale/RatingScalePage'
import { ratingScaleConfigs } from '@/features/settings/rating-scale/config'

export default function SettingsSeverityPage() {
  return <RatingScalePage config={ratingScaleConfigs.severity} />
}
