# PFMEA demo - Tire replacement process in automotive service

Purpose: sample PFMEA content prepared to demonstrate a cascading table layout with multiple failure modes, effects and causes under the same process operations.

Project/process name: Tire Replacement Service  
Scope: Seasonal tire change or tire replacement in an automotive workshop  
Assumption: Customer vehicle arrives with wheels/tires to be replaced, balanced, installed and handed over after final safety checks.

## Cascade structure

| Operation | Failure Mode | Effect | Cause |
|---|---|---|---|
| 10. Vehicle reception and work order confirmation | Wrong tire set selected | Wrong tires installed on vehicle | Tire storage label unreadable or missing |
| 10. Vehicle reception and work order confirmation | Wrong tire set selected | Wrong tires installed on vehicle | Work order does not include tire size / axle position |
| 10. Vehicle reception and work order confirmation | Wrong tire set selected | Customer return / rework | Customer tires stored under similar name or plate number |
| 10. Vehicle reception and work order confirmation | Tire condition not assessed before installation | Unsafe tire returned to service | Visual inspection skipped due to workload |
| 10. Vehicle reception and work order confirmation | Tire condition not assessed before installation | Reduced traction or tire failure | Tread depth / sidewall damage not checked |
| 20. Lift vehicle and remove wheels | Vehicle lifted at wrong point | Vehicle underbody or sill damage | Lift point diagram not checked |
| 20. Lift vehicle and remove wheels | Vehicle lifted at wrong point | Technician injury / vehicle instability | Wrong adapter or pad position used |
| 20. Lift vehicle and remove wheels | Wheel fastener damaged or lost | Delay in service completion | Incorrect socket or worn socket used |
| 20. Lift vehicle and remove wheels | Wheel fastener damaged or lost | Wheel cannot be safely installed | Nuts / bolts not stored in controlled tray |
| 30. Demount old tire from rim | Rim damaged during demounting | Air leak after installation | Bead breaker positioned too close to rim lip |
| 30. Demount old tire from rim | Rim damaged during demounting | Cosmetic damage visible to customer | Insufficient lubrication during demounting |
| 30. Demount old tire from rim | TPMS sensor damaged | TPMS warning light after handover | Sensor location not identified before demounting |
| 30. Demount old tire from rim | TPMS sensor damaged | Additional repair cost and delay | Metal tool contacts valve/sensor body |
| 40. Mount new tire on rim | Tire mounted in wrong direction | Poor wet grip / braking performance | Directional arrow or outside marking missed |
| 40. Mount new tire on rim | Tire mounted in wrong direction | Noise or customer complaint | No second check after mounting |
| 40. Mount new tire on rim | Tire bead not seated correctly | Sudden pressure loss | Rim corrosion or dirt on bead seat not cleaned |
| 40. Mount new tire on rim | Tire bead not seated correctly | Vehicle instability after handover | Lubrication insufficient during mounting |
| 50. Balance wheel assembly | Wheel imbalance remains | Steering wheel vibration | Old weights not fully removed |
| 50. Balance wheel assembly | Wheel imbalance remains | Customer return / repeat balancing | Balancing machine not calibrated |
| 50. Balance wheel assembly | Incorrect weight type or placement | Wheel damage or lost weight | Rim type incorrectly selected in balancer |
| 60. Install wheel on vehicle | Incorrect tightening torque | Wheel loosening in service | Torque wrench not used for final tightening |
| 60. Install wheel on vehicle | Incorrect tightening torque | Stud / bolt thread damage | Impact wrench used as final torque method |
| 60. Install wheel on vehicle | Wheel installed in wrong position | Rotation plan not followed | Wheel position labels missing |
| 70. Final checks and handover | Incorrect tire pressure | Poor handling / uneven tire wear | Vehicle pressure specification not checked |
| 70. Final checks and handover | Incorrect tire pressure | TPMS alert or customer complaint | Pressure set when tires are hot without correction |
| 70. Final checks and handover | TPMS not reset | Warning light after handover | Reset step skipped |
| 70. Final checks and handover | Missing final safety check | Defect reaches customer | Final checklist not completed |

## PFMEA table

| OP | Operation | Failure Mode | Characteristic | Class | Effect | SEV | Cause | OCC | Current Controls (Prev) | Current Controls (Det) | DET | RPN | PCP | Recommended Action | Responsible | Target Date | Action Status |
|---:|---|---|---|---|---|---:|---|---:|---|---|---:|---:|:---:|---|---|---|---|
| 10 | Vehicle reception and work order confirmation | Wrong tire set selected | Tire set identification | S | Wrong tires installed on vehicle | 8 | Tire storage label unreadable or missing | 4 | Tire sets stored with customer name and plate number | Reception verifies plate number against work order | 5 | 160 | Yes | Add barcode/QR label on tire storage tags and scan at release from storage. | Service Manager | 2026-05-15 | Open |
| 10 | Vehicle reception and work order confirmation | Wrong tire set selected | Tire set identification | S | Wrong tires installed on vehicle | 8 | Work order does not include tire size / axle position | 3 | Service advisor enters vehicle registration and tire size manually | Technician checks size on tire sidewall before mounting | 4 | 96 | Yes | Make tire size and axle position mandatory fields in reception checklist. | Service Advisor Lead | 2026-05-20 | Open |
| 10 | Vehicle reception and work order confirmation | Wrong tire set selected | Tire set identification | S | Customer return / rework | 6 | Customer tires stored under similar name or plate number | 3 | Storage rack organized by customer ID | Final invoice review by service advisor | 5 | 90 | No | Add unique customer/tire-set ID on all storage locations. | Warehouse Owner | 2026-05-28 | Planned |
| 10 | Vehicle reception and work order confirmation | Tire condition not assessed before installation | Tire safety condition | S | Unsafe tire returned to service | 9 | Visual inspection skipped due to workload | 4 | General workshop instruction requires tire inspection | No formal documented inspection record | 6 | 216 | Yes | Add mandatory tread depth and sidewall inspection fields before mounting. | Quality Champion | 2026-05-18 | Open |
| 10 | Vehicle reception and work order confirmation | Tire condition not assessed before installation | Tire safety condition | S | Reduced traction or tire failure | 9 | Tread depth / sidewall damage not checked | 3 | Technician visually reviews tire during handling | Customer complaint after service | 7 | 189 | Yes | Provide tread depth gauge at each bay and require photo evidence for rejected tires. | Workshop Supervisor | 2026-05-25 | Open |
| 20 | Lift vehicle and remove wheels | Vehicle lifted at wrong point | Vehicle lifting point | S | Vehicle underbody or sill damage | 7 | Lift point diagram not checked | 3 | Technician training on standard lift points | Damage noticed during service or by customer | 5 | 105 | No | Add vehicle lift-point quick reference at each lift. | Workshop Supervisor | 2026-06-01 | Planned |
| 20 | Lift vehicle and remove wheels | Vehicle lifted at wrong point | Vehicle stability | S | Technician injury / vehicle instability | 10 | Wrong adapter or pad position used | 2 | Lift equipment inspected daily | Visual check before raising vehicle fully | 4 | 80 | Yes | Require two-step lift: raise 10 cm, verify stability, then continue. | HSE Owner | 2026-05-22 | Open |
| 20 | Lift vehicle and remove wheels | Wheel fastener damaged or lost | Wheel nut / bolt integrity |  | Delay in service completion | 5 | Incorrect socket or worn socket used | 4 | Standard socket set available at bay | Technician notices damaged fastener during removal | 5 | 100 | No | Add socket condition check to weekly tool inspection. | Tooling Owner | 2026-06-03 | Planned |
| 20 | Lift vehicle and remove wheels | Wheel fastener damaged or lost | Wheel nut / bolt control | S | Wheel cannot be safely installed | 8 | Nuts / bolts not stored in controlled tray | 3 | Technician places hardware near removed wheel | Final wheel installation count check | 5 | 120 | Yes | Use dedicated magnetic tray per wheel position. | Workshop Supervisor | 2026-05-30 | Open |
| 30 | Demount old tire from rim | Rim damaged during demounting | Rim sealing surface |  | Air leak after installation | 8 | Bead breaker positioned too close to rim lip | 3 | Demounting machine has standard operating instruction | Leak check after tire inflation | 4 | 96 | Yes | Mark safe bead breaker position and retrain technicians. | Service Trainer | 2026-05-29 | Planned |
| 30 | Demount old tire from rim | Rim damaged during demounting | Rim cosmetic surface |  | Cosmetic damage visible to customer | 5 | Insufficient lubrication during demounting | 5 | Lubricant available next to machine | Visual check after demounting | 5 | 125 | No | Add lubrication point to demount checklist and keep dispenser mounted at machine. | Workshop Supervisor | 2026-06-05 | Open |
| 30 | Demount old tire from rim | TPMS sensor damaged | TPMS sensor integrity | S | TPMS warning light after handover | 7 | Sensor location not identified before demounting | 4 | Some technicians mark valve position manually | TPMS warning checked during final ignition check | 5 | 140 | Yes | Add TPMS sensor position check before bead breaking. | Quality Champion | 2026-05-24 | Open |
| 30 | Demount old tire from rim | TPMS sensor damaged | TPMS valve/sensor |  | Additional repair cost and delay | 6 | Metal tool contacts valve/sensor body | 3 | Technician training on TPMS handling | Visual sensor check after demounting | 5 | 90 | No | Introduce plastic-protected tool for TPMS area. | Tooling Owner | 2026-06-08 | Planned |
| 40 | Mount new tire on rim | Tire mounted in wrong direction | Tire rotation direction / outside marking | S | Poor wet grip / braking performance | 9 | Directional arrow or outside marking missed | 3 | Technician checks tire sidewall during mounting | Final visual check before wheel installation | 4 | 108 | Yes | Add directional/outside marking check to mounting checklist. | Workshop Supervisor | 2026-05-21 | Open |
| 40 | Mount new tire on rim | Tire mounted in wrong direction | Tire orientation |  | Noise or customer complaint | 5 | No second check after mounting | 4 | Technician self-check | Customer complaint or road test | 6 | 120 | No | Require second-person check for directional/asymmetric tires. | Service Manager | 2026-06-10 | Planned |
| 40 | Mount new tire on rim | Tire bead not seated correctly | Bead seating / air retention | S | Sudden pressure loss | 10 | Rim corrosion or dirt on bead seat not cleaned | 3 | Rim visually checked during demounting | Leak test after inflation | 4 | 120 | Yes | Add bead seat cleaning requirement for corrosion or debris. | Workshop Supervisor | 2026-05-27 | Open |
| 40 | Mount new tire on rim | Tire bead not seated correctly | Bead seating | S | Vehicle instability after handover | 9 | Lubrication insufficient during mounting | 3 | Lubricant available at machine | Pressure stability observed after inflation | 5 | 135 | Yes | Define minimum lubrication points on SOP with photo standard. | Service Trainer | 2026-06-07 | Planned |
| 50 | Balance wheel assembly | Wheel imbalance remains | Wheel balance quality |  | Steering wheel vibration | 5 | Old weights not fully removed | 5 | Technician removes visible weights before balancing | Balancer residual imbalance result | 4 | 100 | No | Add old-weight removal confirmation before first spin. | Workshop Supervisor | 2026-05-23 | Open |
| 50 | Balance wheel assembly | Wheel imbalance remains | Balancer accuracy |  | Customer return / repeat balancing | 6 | Balancing machine not calibrated | 3 | Annual external calibration | Balancer self-test available but not always used | 6 | 108 | No | Add weekly balancer verification with reference wheel. | Maintenance Owner | 2026-06-12 | Planned |
| 50 | Balance wheel assembly | Incorrect weight type or placement | Wheel weight attachment |  | Wheel damage or lost weight | 5 | Rim type incorrectly selected in balancer | 4 | Technician selects rim mode manually | Visual check after weight installation | 5 | 100 | No | Add rim type decision aid near balancer. | Service Trainer | 2026-06-14 | Planned |
| 60 | Install wheel on vehicle | Incorrect tightening torque | Wheel bolt torque | S | Wheel loosening in service | 10 | Torque wrench not used for final tightening | 3 | Torque specification poster at bay | No independent torque record | 6 | 180 | Yes | Require recorded final torque confirmation for each wheel. | Quality Champion | 2026-05-19 | Open |
| 60 | Install wheel on vehicle | Incorrect tightening torque | Stud / bolt thread integrity | S | Stud / bolt thread damage | 8 | Impact wrench used as final torque method | 4 | Impact wrench used for rundown only by instruction | Technician detects abnormal tightening feel | 5 | 160 | Yes | Add torque-limited rundown sockets and audit final torque method. | Workshop Supervisor | 2026-05-31 | Open |
| 60 | Install wheel on vehicle | Wheel installed in wrong position | Wheel position / rotation plan |  | Rotation plan not followed | 4 | Wheel position labels missing | 5 | Wheel position sometimes marked with chalk | Customer may report noise or uneven wear later | 7 | 140 | No | Use LF/RF/LR/RR labels before wheel removal. | Service Advisor Lead | 2026-06-04 | Planned |
| 70 | Final checks and handover | Incorrect tire pressure | Tire pressure | S | Poor handling / uneven tire wear | 8 | Vehicle pressure specification not checked | 4 | Pressure set using common default values | TPMS may detect major deviation | 5 | 160 | Yes | Require vehicle-specific pressure value on final checklist. | Quality Champion | 2026-05-17 | Open |
| 70 | Final checks and handover | Incorrect tire pressure | Tire pressure stability |  | TPMS alert or customer complaint | 6 | Pressure set when tires are hot without correction | 3 | Technician sets pressure at end of service | Customer complaint or TPMS warning | 6 | 108 | No | Add cold/hot pressure correction note to SOP. | Service Trainer | 2026-06-11 | Planned |
| 70 | Final checks and handover | TPMS not reset | TPMS system status |  | Warning light after handover | 5 | Reset step skipped | 4 | Technician performs ignition check | Customer notices warning light | 5 | 100 | No | Add TPMS reset confirmation to handover checklist. | Service Advisor Lead | 2026-05-26 | Open |
| 70 | Final checks and handover | Missing final safety check | Final release control | S | Defect reaches customer | 9 | Final checklist not completed | 3 | Informal technician self-check | Customer complaint or incident | 7 | 189 | Yes | Make final checklist mandatory before job closure. | Service Manager | 2026-05-16 | Open |

## Suggested demo highlights

- Operation 10 has two failure modes and five causes/effects to show first-level cascade.
- Operation 30 and 40 show technical tire handling risks and TPMS-related risks.
- Operation 60 contains safety-critical torque risks with high severity.
- Operation 70 closes the process with final checks, pressure, TPMS and handover controls.
- The table contains repeated operation/failure/effect values intentionally, so merged/cascading PFMEA cells are visible in the application.
