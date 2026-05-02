export type RatingScaleConfig = {
  cacheKey: string
  defaults: Record<number, { name: string; description: string }>
  description: string
  emptyMessage: string
  effectiveRpc: string
  key: 'severity' | 'occurrence' | 'detection'
  overridesTable: string
  title: string
}

export const ratingScaleConfigs: Record<RatingScaleConfig['key'], RatingScaleConfig> = {
  severity: {
    key: 'severity',
    title: 'Severity',
    description: 'Define severity scale values and descriptions used in PFMEA scoring.',
    effectiveRpc: 'get_severity_effective',
    overridesTable: 'severity_overrides',
    cacheKey: '__SETTINGS_SEVERITY_CACHE__',
    emptyMessage: 'No severity levels defined.',
    defaults: {
      10: {
        name: 'Safety hazard - Failure affects safe operation of the product or user safety.',
        description:
          'Risk of injury or hazardous event\nLoss of a safety function or protective lockout\nOverheating, short circuit, electric shock or fire\nUnsafe mechanical behavior, for example uncontrolled movement\nBreach of customer safety requirements or safety standards',
      },
      9: {
        name: 'Critical compliance or customer damage - Non-compliance with regulations or risk of damage to customer equipment.',
        description:
          'Regulatory or legal non-compliance\nDamage to customer equipment or connected systems\nHigh-cost customer failure without direct safety hazard\nCustomer line stoppage caused by the product\nCritical customer complaint or escalation',
      },
      8: {
        name: 'Loss of primary function - Loss of the primary function required for normal use.',
        description:
          'Product cannot perform its core function\nNo start-up or not usable in normal operation\nFailure within the expected life or usage period\nKey functional parameters are not met\nCustomer repair or replacement is required to restore usability',
      },
      7: {
        name: 'Degradation of primary function - The primary function works, but noticeably worse.',
        description:
          'Performance is clearly reduced\nOperation is unstable or intermittent\nPrimary function life is shorter than expected\nFrequent resets or interruptions occur during use\nUsable, but below customer expectations',
      },
      6: {
        name: 'Loss of secondary function - The product works, but an auxiliary function is missing.',
        description:
          'Auxiliary feature is missing\nOptions or modes are unavailable while core function still works\nA workaround is required by the user\nConvenience is reduced without losing the main function\nAn extra service action is needed to restore the auxiliary function',
      },
      5: {
        name: 'Degradation of secondary function - An auxiliary function still works, but worse than expected.',
        description:
          'Lower quality or performance of an auxiliary function\nOccasional disturbances in an auxiliary function\nLonger response or operation time for an auxiliary function\nIncreased noise or vibration in an auxiliary function\nMinor user adjustments or calibration are required',
      },
      4: {
        name: 'Strongly objectionable appearance or feel - Appearance, sound, vibration or tactile quality is very undesirable.',
        description:
          'Visible cosmetic defects on customer-visible surfaces\nClearly noticeable noise or vibration perceived as a defect\nSharp edges or very unpleasant tactile feel\nHigh customer dissatisfaction despite acceptable function\nHigh risk of complaint or cosmetic return',
      },
      3: {
        name: 'Moderately objectionable appearance or feel - Noticeable, but usually acceptable, degradation in fit or finish.',
        description:
          'Medium cosmetic defects that may still be accepted\nModerate noise or vibration with no functional impact\nMinor finishing or fit issues\nUser notices the issue, but often still accepts it\nLow-to-moderate risk of complaint',
      },
      2: {
        name: 'Slightly objectionable appearance or feel - Minor deviation with very limited user impact.',
        description:
          'Minor cosmetic defects outside visible area\nSmall deviations in appearance or finish\nSubtle noise or vibration within acceptable limits\nMinor tactile differences without functional relevance\nUsually no complaints or only isolated cases',
      },
      1: {
        name: 'No noticeable effect - No discernible effect for the user.',
        description:
          'No noticeable difference in function or appearance\nNo impact on requirements or functional specification\nCosmetic deviation is not detectable by the user\nFull user acceptance\nNo impact on safety, compliance or functionality',
      },
    },
  },
  occurrence: {
    key: 'occurrence',
    title: 'Occurrence',
    description: 'Define occurrence scale values and examples used for prevention scoring.',
    effectiveRpc: 'get_occurrence_effective',
    overridesTable: 'occurrence_overrides',
    cacheKey: '__SETTINGS_OCCURRENCE_CACHE__',
    emptyMessage: 'No occurrence levels defined.',
    defaults: {
      10: {
        name: 'Extremely high (1 in 10) - No preventive controls; cause is practically uncontrolled.',
        description:
          'No preventive controls\nNo work standard or instructions\nVerbal reminder only\nSelf-check without criteria or evidence\nNo tooling standard or 5S',
      },
      9: {
        name: 'Very high (1 in 20) - Controls have minimal impact on preventing the cause.',
        description:
          'General rules or training without competency confirmation\nGeneral instruction without photos or critical points\nQuality reminders without verification\nSelf-check without criteria\nFree selection of parts without kitting',
      },
      8: {
        name: 'High (1 in 50) - Controls reduce risk only slightly; error is still frequent.',
        description:
          'Generic work standard without validation\nWorkstation visual aids\nGolden sample or station reference\nOrientation markings\nColor coding of parts and tools',
      },
      7: {
        name: 'Elevated (1 in 100) - Controls are only partially effective at preventing the cause.',
        description:
          'Paper instruction\nPaper checklist with operator signature\n5S plus tool and location markings\nKitting with one set per piece\nPeer check for a critical step',
      },
      6: {
        name: 'Medium (1 in 500) - Controls are partially effective and still dependent on people.',
        description:
          'Digital work instructions with visual aids\nDigital checklists with mandatory confirmation photo\nAssembly template, guide or positioning stop\nGo or no-go gauge\nDepth stop or guide bushing',
      },
      5: {
        name: 'Moderate (1 in 2,000) - Controls are effective at preventing the cause.',
        description:
          'Screwdriver with interchangeable bits\nTorque tools with set torque without data recording\nDedicated tool or bit selection\nPosition stops or markers\nKit weight check',
      },
      4: {
        name: 'Low (1 in 10,000) - Controls are highly effective; error is rare.',
        description:
          'Dedicated screwdriver or tool\nDedicated tool for one operation only\nAssembly guides or positioning fixture\nPick-to-light or put-to-light\nTorque tool with OK or NOK signal',
      },
      3: {
        name: 'Very low (1 in 100,000) - Controls are highly effective; error is exceptional.',
        description:
          'Scanning with process-enforced verification\n1D or 2D scanning with traceability\nSystem interlock such as MES block\n2D vision camera to confirm presence or orientation\nPresence sensors',
      },
      2: {
        name: 'Minimal (1 in 1,000,000) - Process enforces correct placement or identification.',
        description:
          'Jig with keying, positioning or pinning\nFixture with sensors that allow start only when correct\nPneumatic or electric lockout\nMechanically keyed connectors\nRecipe management loaded only after scan',
      },
      1: {
        name: 'Cause eliminated - Error is impossible by design or process.',
        description:
          'Poka-yoke makes the error physically impossible\nGeometry prevents wrong assembly\nHard process interlock\nDedicated tool with angle or torque measurement plus digital work instructions\nDesign or process change removes the cause',
      },
    },
  },
  detection: {
    key: 'detection',
    title: 'Detection',
    description: 'Define detection scale values and examples used for detection scoring.',
    effectiveRpc: 'get_detection_effective',
    overridesTable: 'detection_overrides',
    cacheKey: '__SETTINGS_DETECTION_CACHE__',
    emptyMessage: 'No detection levels defined.',
    defaults: {
      10: {
        name: 'Undetectable - The failure type will not be detected or cannot be detected.',
        description:
          'No detection controls or no control point\nEnd-of-line check only, without criteria or record\nNo measurement or inspection for the critical characteristic\nNo functional test for the related function\nNo traceability',
      },
      9: {
        name: 'Incidental detection - Failure is not easily detected in random or sporadic audits.',
        description:
          'LPA audit or quality walk done sporadically\nRandom sampling with a small sample\nAd-hoc check by leader or setter\nVisual check without acceptance standard\nOccasional review of documents or records',
      },
      8: {
        name: '100 percent manual detection - Human inspection or manual gauges are expected to detect the failure.',
        description:
          '100 percent visual inspection\nManual inspection with paper checklist\nManual measurement without recording\nManual functional test without record\nComparison against a reference sample',
      },
      7: {
        name: 'Assisted detection - Semi-automatic or signal-based detection is expected to detect the failure.',
        description:
          'Label scanning to confirm operation\nSensor with ANDON signal but no block\nSemi-automatic check with operator decision\nIn-station measurement with manual confirmation\nSampling inspection on tester or gauge',
      },
      6: {
        name: 'Multi-stage 100 percent detection - Detection is manual, but done in multiple stages or as full final inspection.',
        description:
          '100 percent visual inspection in two stages\n100 percent final inspection by quality\nManual 100 percent functional test with checklist and signature\nManual 100 percent measurement with recorded result\n100 percent attribute check with clear acceptance standard',
      },
      5: {
        name: 'Full detection without interlock - Automatic detection provides a signal, but does not block flow.',
        description:
          '100 percent testing without flow lockout\nOrder-based kitting\nLabel printing after data verification\nAutomatic measurement with alarm only\nVision system with alarm but no interlock',
      },
      4: {
        name: 'Quality gate and NOK separation - Automatic detection prevents further processing or dispatch of NOK.',
        description:
          '100 percent detection on a tester not connected to the next step\nAutomatic separation of NOK\nShipment block without OK status\nSimple system interlock without inspection result\nAutomatic hold of a batch on NOK',
      },
      3: {
        name: 'Process interlock - Automatic detection at station prevents pushing NOK through the process.',
        description:
          'Station interlock blocks the next operation\n100 percent torque verification with digital work instructions\nVision system with pass or fail interlock\nTester with automatic flow lockout\nJidoka level 2 style stop on NOK',
      },
      2: {
        name: 'Prevention of NOK - Machine detection prevents creation of nonconforming product.',
        description:
          'Poka-yoke with sensors blocks cycle start\nKeyed fixture plus presence sensors\n100 percent automatic measurement of critical parameter\nDispensing with volume control plus interlock\nRecipe or parameters loaded only after scan',
      },
      1: {
        name: 'Guaranteed detection or error impossible - Failure cannot be produced or detection always proves it.',
        description:
          'Jidoka level 1 ensures detection at the next operation\n100 percent tester detection cannot be skipped\nPart label scan linked with digital work instructions\nGeometry or keying prevents wrong assembly\nHard interlock blocks release without OK in the system',
      },
    },
  },
}
