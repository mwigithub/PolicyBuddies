# PolicyBuddies Life Insurance Metadata Standard (MVP)

## Document Control
- Product: Project Buddies (PolicyBuddies)
- Purpose: Define a consistent life-insurance metadata contract for ingestion, retrieval, and simulation
- Status: Draft for alignment
- Version: `li-metadata-v1`
- Last updated: 2026-02-21

## 1. Design Goals
- Align metadata with life insurance operational practice (product, policy, document, governance).
- Keep ingestion backward compatible with existing fields (`productName`, `versionLabel`, `jurisdiction`, `documentType`).
- Support formula simulation traceability and auditability.

## 2. Metadata Domains
| Domain | Purpose |
| --- | --- |
| `coreMetadata` | Product-agnostic metadata shared across all insurance product types |
| `productMetadata` | Product-profile-specific metadata payload (extensible by profile) |
| `product` | Business identity of insurance offering |
| `policy` | Policy-level classification and business context |
| `benefitAttributes` | Product benefit semantics for simulation and comparison |
| `industryStandardTerms` | Canonical insurance terminology detection and normalization |
| `document` | Source-document identity and lifecycle |
| `governance` | Compliance, ownership, and audit context |

Multi-product organization rule:
- Keep shared attributes inside `coreMetadata`.
- Put product-specific attributes under `productMetadata.data`, keyed by `profileId`.
- Example future profiles: `life-investment-linked`, `life-term`, `general-motor`, `health-hospital`.

## 3. Canonical Fields (v1)
| Field | Required | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `metadataStandardVersion` | Yes | string | `li-metadata-v1` | Contract version |
| `metadataParserVersion` | Yes | string | `li-metadata-parser-v2` | Parser implementation version |
| `coreMetadata` | Yes | object | `{...}` | Product-agnostic metadata container |
| `productMetadata.profileId` | Yes | string | `life-investment-linked` | Product profile selector |
| `productMetadata.profileVersion` | Yes | string | `v1` | Profile contract version |
| `productMetadata.schemaVersion` | Yes | string | `1.0.0` | Schema semantic version |
| `productMetadata.data` | Yes | object | `{benefitAttributes:{...}}` | Product-specific attributes |
| `productMetadata.data.industryStandardTerms` | Yes | object | `{terms:[...],coverageRatio:0.82}` | Detected canonical insurance terms |
| `productMetadata.data.industryStandardTerms.terms[]` | Yes | array item | `{canonicalTerm:"sum_assured",detected:true,...}` | Term-level detection record |
| `productMetadata.data.industryStandardTerms.terms[].canonicalTerm` | Yes | string | `sum_assured` | Canonical industry term key |
| `productMetadata.data.industryStandardTerms.terms[].standardLabel` | Yes | string | `Sum Assured` | Human-readable standard label |
| `productMetadata.data.industryStandardTerms.terms[].aliases` | Yes | array | `["sum assured","basic sum assured"]` | Alias patterns used |
| `productMetadata.data.industryStandardTerms.terms[].detected` | Yes | boolean | `true` | Detection status |
| `productMetadata.data.industryStandardTerms.terms[].sourceCitation.lineRange` | No | string/null | `151-151` | First evidence line match |
| `productMetadata.data.industryStandardTerms.coverageRatio` | Yes | number | `0.818` | Detection coverage across configured term set |
| `productMetadata.mappingWarnings` | Yes | array | `[]` | Parsing/validation warnings |
| `product.productName` | Yes | string | `Wealth Pro (II)` | Human product name |
| `product.productCode` | No | string/null | `UNZS` | Internal insurer code |
| `product.productFamily` | Yes | enum | `investment-linked` | Example enums below |
| `product.insurerName` | No | string/null | `Tokio Marine Life Insurance Singapore Ltd.` | Carrier/legal entity |
| `product.jurisdiction` | Yes | string | `SG` | Market/legal jurisdiction |
| `product.currency` | No | string/null | `SGD` | Base product currency |
| `product.productLevel.productCategory` | Yes | enum | `to be defined` | e.g. `protection`, `savings`, `investment-linked` |
| `product.productLevel.planType` | Yes | enum | `to be defined` | e.g. `basic`, `rider`, `bundle` |
| `product.productLevel.premiumType` | Yes | enum | `to be defined` | e.g. `regular`, `single`, `limited-pay` |
| `product.productLevel.premiumPaymentTerm` | No | string/null | `10 years` | Payment term |
| `product.productLevel.policyTerm` | No | string/null | `to age 99` | Coverage term |
| `product.productLevel.issueAgeRange` | No | string/null | `18-70` | Entry age band |
| `product.productLevel.lifeAssuredType` | Yes | enum | `to be defined` | `single-life`, `joint-life`, `multi-life` |
| `product.productLevel.distributionChannel` | Yes | enum | `to be defined` | `agency`, `bancassurance`, `ifa`, `direct` |
| `policy.lineOfBusiness` | Yes | enum | `life-insurance` | `life-insurance` for MVP |
| `policy.participatingType` | Yes | enum | `to be defined` | `participating`, `non-participating`, `to be defined` |
| `policy.shariahCompliant` | Yes | enum | `to be defined` | `yes`, `no`, `to be defined` |
| `policy.targetMarketSegment` | Yes | string | `to be defined` | Retail/HNW/etc |
| `benefitAttributes.sumAssured.amount` | No | number/null | `100000` | Policy sum assured |
| `benefitAttributes.sumAssured.currency` | No | string/null | `SGD` | Sum assured currency |
| `benefitAttributes.sumAssured.basis` | Yes | enum | `face-amount` | `face-amount`, `account-value-linked`, `to be defined` |
| `benefitAttributes.guaranteedValue.amount` | No | number/null | `50000` | Guaranteed value amount |
| `benefitAttributes.guaranteedValue.currency` | No | string/null | `SGD` | Guaranteed value currency |
| `benefitAttributes.guaranteedValue.valueType` | Yes | enum | `maturity` | `maturity`, `cash-value`, `death-benefit-floor`, `to be defined` |
| `benefitAttributes.dividendScale.scaleType` | Yes | enum | `reversionary` | `reversionary`, `terminal`, `cash`, `none`, `to be defined` |
| `benefitAttributes.dividendScale.currentRate` | No | number/null | `0.035` | Current dividend/bonus scale (if disclosed) |
| `benefitAttributes.dividendScale.effectiveDate` | No | string/null | `2025-01-01` | Date scale applies from |
| `benefitAttributes.dividendScale.isGuaranteed` | Yes | enum | `no` | `yes` or `no` |
| `benefitAttributes.bonuses` | Yes | array | `[]` | Structured bonus metadata entries |
| `benefitAttributes.bonuses[].bonusType` | Yes | enum | `initial bonus` | Bonus category |
| `benefitAttributes.bonuses[].formulaExpression` | No | string/null | `1.80% x Accumulation Units Account value` | Normalized formula |
| `benefitAttributes.bonuses[].rate` | No | number/null | `0.018` | Bonus rate |
| `benefitAttributes.bonuses[].rateUnit` | No | enum/null | `percentage` | Unit of rate |
| `benefitAttributes.bonuses[].basis` | No | string/null | `Accumulation Units Account value` | Calculation basis |
| `benefitAttributes.bonuses[].appliesFrom` | No | string/null | `starting from end of 4th policy year` | Eligibility start |
| `benefitAttributes.bonuses[].appliesTo` | No | string/null | `end of minimum investment period` | Eligibility end |
| `benefitAttributes.bonuses[].isGuaranteed` | Yes | enum | `no` | `yes`, `no`, `to be defined` |
| `benefitAttributes.bonuses[].sourceCitation.lineRange` | Yes | string | `160-185` | Source traceability |
| `benefitAttributes.bonuses[].parserConfidence` | Yes | enum | `high` | `low`, `medium`, `high` |
| `benefitAttributes.guaranteedBenefits` | Yes | array | `[]` | List of guaranteed benefit labels |
| `benefitAttributes.nonGuaranteedBenefits` | Yes | array | `[]` | List of non-guaranteed benefit labels |
| `benefitAttributes.projectionAssumptions.rates` | Yes | array | `[0.04,0.08]` | Projection/illustration rates |
| `benefitAttributes.projectionAssumptions.notes` | Yes | array | `[]` | Assumption notes |
| `document.fileName` | Yes | string | `Product Summary.pdf` | Original source filename |
| `document.documentType` | Yes | enum | `product summary` | Controlled type list |
| `document.versionLabel` | Yes | string | `refresh-2026-02-21` | Ingestion/business version |
| `document.language` | Yes | string | `en` | ISO language style |
| `document.issueDate` | No | string/null | `2025-05-05` | Publication date |
| `document.effectiveDate` | No | string/null | `2025-05-05` | Effective date |
| `document.mimeType` | Yes | string | `application/pdf` | Technical media type |
| `governance.sourceSystem` | Yes | enum | `manual-ingestion` | Source origin |
| `governance.actorId` | No | string/null | `system` | User/system identifier |
| `governance.dataClass` | Yes | enum | `internal` | Data handling class |
| `governance.piiContains` | Yes | enum | `to be defined` | `yes`, `no`, `to be defined` |
| `governance.regulatoryRegime` | Yes | string | `to be defined` | MAS/other regime tag |
| `governance.createdAt` | Yes | datetime | `2026-02-21T05:00:00.000Z` | Record creation |
| `governance.updatedAt` | Yes | datetime | `2026-02-21T05:00:00.000Z` | Record update |

## 4. Controlled Enumerations (MVP)
| Field | Allowed Values (MVP) |
| --- | --- |
| `product.productFamily` | `investment-linked`, `term-life`, `whole-life`, `endowment`, `annuity`, `to be defined` |
| `product.productLevel.productCategory` | `protection`, `savings`, `investment-linked`, `retirement`, `health`, `to be defined` |
| `product.productLevel.planType` | `basic`, `rider`, `bundle`, `to be defined` |
| `product.productLevel.premiumType` | `regular`, `single`, `limited-pay`, `to be defined` |
| `product.productLevel.lifeAssuredType` | `single-life`, `joint-life`, `multi-life`, `to be defined` |
| `product.productLevel.distributionChannel` | `agency`, `bancassurance`, `ifa`, `direct`, `to be defined` |
| `benefitAttributes.sumAssured.basis` | `face-amount`, `account-value-linked`, `to be defined` |
| `benefitAttributes.guaranteedValue.valueType` | `maturity`, `cash-value`, `death-benefit-floor`, `to be defined` |
| `benefitAttributes.dividendScale.scaleType` | `reversionary`, `terminal`, `cash`, `none`, `to be defined` |
| `benefitAttributes.dividendScale.isGuaranteed` | `yes`, `no` |
| `benefitAttributes.bonuses[].bonusType` | `initial bonus`, `performance investment bonus`, `loyalty bonus`, `power-up bonus`, `to be defined` |
| `benefitAttributes.bonuses[].rateUnit` | `percentage`, `absolute`, `to be defined` |
| `benefitAttributes.bonuses[].isGuaranteed` | `yes`, `no`, `to be defined` |
| `benefitAttributes.bonuses[].parserConfidence` | `low`, `medium`, `high` |
| `document.documentType` | `product summary`, `product illustration`, `product brochure`, `fact find` |
| `policy.participatingType` | `participating`, `non-participating`, `to be defined` |
| `policy.shariahCompliant` | `yes`, `no`, `to be defined` |
| `governance.dataClass` | `public`, `internal`, `confidential` |
| `governance.piiContains` | `yes`, `no`, `to be defined` |

## 5. Backward Compatibility Mapping
| Existing Field | New Canonical Path |
| --- | --- |
| `productName` | `product.productName` |
| `versionLabel` | `document.versionLabel` |
| `jurisdiction` | `product.jurisdiction` |
| `documentType` | `document.documentType` |

## 6. Storage in Catalog
- Existing flat fields remain for current modules.
- New structured object is stored as `businessMetadata`.
- Standard version marker is stored as `metadataStandardVersion`.

## 7. Example
```json
{
  "metadataStandardVersion": "li-metadata-v1",
  "metadataParserVersion": "li-metadata-parser-v2",
  "businessMetadata": {
    "coreMetadata": {
      "product": {
        "productName": "Product Summary",
        "productCode": null,
        "productFamily": "investment-linked",
        "insurerName": null,
        "jurisdiction": "SG",
        "currency": null,
        "productLevel": {
          "productCategory": "to be defined",
          "planType": "to be defined",
          "premiumType": "to be defined",
          "premiumPaymentTerm": null,
          "policyTerm": null,
          "issueAgeRange": null,
          "lifeAssuredType": "to be defined",
          "distributionChannel": "to be defined"
        }
      },
      "policy": {
        "lineOfBusiness": "life-insurance",
        "participatingType": "to be defined",
        "shariahCompliant": "to be defined",
        "targetMarketSegment": "to be defined"
      },
      "document": {
        "fileName": "Product Summary.pdf",
        "documentType": "product summary",
        "versionLabel": "refresh-2026-02-21",
        "language": "en",
        "issueDate": null,
        "effectiveDate": null,
        "mimeType": "application/pdf"
      },
      "governance": {
        "sourceSystem": "manual-ingestion",
        "actorId": "system",
        "dataClass": "internal",
        "piiContains": "to be defined",
        "regulatoryRegime": "to be defined",
        "createdAt": "2026-02-21T05:00:00.000Z",
        "updatedAt": "2026-02-21T05:00:00.000Z"
      }
    },
    "productMetadata": {
      "profileId": "life-investment-linked",
      "profileVersion": "v1",
      "schemaVersion": "1.0.0",
      "data": {
        "benefitAttributes": {
          "sumAssured": {
            "amount": null,
            "currency": null,
            "basis": "to be defined"
          },
          "guaranteedValue": {
            "amount": null,
            "currency": null,
            "valueType": "to be defined"
          },
          "dividendScale": {
            "scaleType": "to be defined",
            "currentRate": null,
            "effectiveDate": null,
            "isGuaranteed": "no"
          },
          "bonuses": [
            {
              "bonusType": "performance investment bonus",
              "formulaExpression": "1.80% x Accumulation Units Account value",
              "rate": 0.018,
              "rateUnit": "percentage",
              "basis": "Accumulation Units Account value",
              "appliesFrom": "starting from the end of the fourth (4th) policy year until the end of minimum investment period",
              "appliesTo": null,
              "isGuaranteed": "to be defined",
              "sourceCitation": {
                "lineRange": "163-180"
              },
              "parserConfidence": "high"
            }
          ],
          "guaranteedBenefits": [],
          "nonGuaranteedBenefits": [],
          "projectionAssumptions": {
            "rates": [],
            "notes": []
          }
        }
      },
      "mappingWarnings": []
    },
    "product": {
      "productName": "Product Summary",
      "productCode": null,
      "productFamily": "investment-linked",
      "insurerName": null,
      "jurisdiction": "SG",
      "currency": null,
      "productLevel": {
        "productCategory": "to be defined",
        "planType": "to be defined",
        "premiumType": "to be defined",
        "premiumPaymentTerm": null,
        "policyTerm": null,
        "issueAgeRange": null,
        "lifeAssuredType": "to be defined",
        "distributionChannel": "to be defined"
      }
    },
    "policy": {
      "lineOfBusiness": "life-insurance",
      "participatingType": "to be defined",
      "shariahCompliant": "to be defined",
      "targetMarketSegment": "to be defined"
    },
    "benefitAttributes": {
      "sumAssured": {
        "amount": null,
        "currency": null,
        "basis": "to be defined"
      },
      "guaranteedValue": {
        "amount": null,
        "currency": null,
        "valueType": "to be defined"
      },
      "dividendScale": {
        "scaleType": "to be defined",
        "currentRate": null,
        "effectiveDate": null,
        "isGuaranteed": "no"
      },
      "bonuses": [
        {
          "bonusType": "performance investment bonus",
          "formulaExpression": "1.80% x Accumulation Units Account value",
          "rate": 0.018,
          "rateUnit": "percentage",
          "basis": "Accumulation Units Account value",
          "appliesFrom": "starting from the end of the fourth (4th) policy year until the end of minimum investment period",
          "appliesTo": null,
          "isGuaranteed": "to be defined",
          "sourceCitation": {
            "lineRange": "163-180"
          },
          "parserConfidence": "high"
        }
      ],
      "guaranteedBenefits": [],
      "nonGuaranteedBenefits": [],
      "projectionAssumptions": {
        "rates": [],
        "notes": []
      }
    },
    "document": {
      "fileName": "Product Summary.pdf",
      "documentType": "product summary",
      "versionLabel": "refresh-2026-02-21",
      "language": "en",
      "issueDate": null,
      "effectiveDate": null,
      "mimeType": "application/pdf"
    },
    "governance": {
      "sourceSystem": "manual-ingestion",
      "actorId": "system",
      "dataClass": "internal",
      "piiContains": "to be defined",
      "regulatoryRegime": "to be defined",
      "createdAt": "2026-02-21T05:00:00.000Z",
      "updatedAt": "2026-02-21T05:00:00.000Z"
    },
    "mappingWarnings": []
  }
}
```
