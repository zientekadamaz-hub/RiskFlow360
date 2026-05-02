'use client'

import { RatingScalePage } from '@/features/settings/rating-scale/RatingScalePage'
import { ratingScaleConfigs } from '@/features/settings/rating-scale/config'

export default function SettingsDetectionPage() {
  return <RatingScalePage config={ratingScaleConfigs.detection} />
}
