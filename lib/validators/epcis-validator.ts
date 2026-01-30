/**
 * EPCIS 2.0 Schema & Business Rules Validator
 * Validates events against GS1 EPCIS 2.0 standard
 */

import { validateGTIN, validateGLN, validateSSCC } from '@/lib/utils/gs1-validation'
import { validateMassBalance, type ValidationResult as MassBalanceResult, validateTransformationEvent } from '@/lib/utils/mass-balance'
import { createClient } from '@/lib/supabase/client' // Import createClient from supabase/client

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  metadata: {
    validatedAt: string
    validatorVersion: string
    rulesApplied: string[]
  }
}

export interface ValidationError {
  code: string
  message: string
  field?: string
  severity: 'critical' | 'error'
}

export interface ValidationWarning {
  code: string
  message: string
  field?: string
  suggestion?: string
}

export class EPCISValidator {
  private version = '2.0.0'
  private supabase = createClient() // createClient is now declared

  /**
   * Get product recipe with conversion factor from database
   */
  private async getProductRecipe(productId: string): Promise<{ 
    conversion_factor: number
    tolerance: number 
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('product_recipes')
        .select('conversion_factor, tolerance')
        .eq('output_product_id', productId)
        .single()

      if (error || !data) {
        return null
      }

      return {
        conversion_factor: data.conversion_factor * 100, // Convert to percentage
        tolerance: data.tolerance || 10
      }
    } catch {
      return null
    }
  }

  /**
   * Validate complete EPCIS event
   */
  async validateEvent(event: any): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const rulesApplied: string[] = []

    // 1. Schema Validation
    const schemaValidation = this.validateSchema(event)
    errors.push(...schemaValidation.errors)
    warnings.push(...schemaValidation.warnings)
    rulesApplied.push('EPCIS_2.0_SCHEMA')

    // 2. GS1 Identifier Validation
    const identifierValidation = this.validateGS1Identifiers(event)
    errors.push(...identifierValidation.errors)
    warnings.push(...identifierValidation.warnings)
    rulesApplied.push('GS1_IDENTIFIERS')

    // 3. Business Rules Validation
    const businessValidation = await this.validateBusinessRules(event)
    errors.push(...businessValidation.errors)
    warnings.push(...businessValidation.warnings)
    rulesApplied.push('BUSINESS_RULES')

    // 4. Data Consistency Validation
    const consistencyValidation = this.validateDataConsistency(event)
    errors.push(...consistencyValidation.errors)
    warnings.push(...consistencyValidation.warnings)
    rulesApplied.push('DATA_CONSISTENCY')

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date().toISOString(),
        validatorVersion: this.version,
        rulesApplied
      }
    }
  }

  /**
   * Validate EPCIS 2.0 Schema structure
   */
  private validateSchema(event: any): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Required fields
    if (!event.event_type) {
      errors.push({
        code: 'MISSING_EVENT_TYPE',
        message: 'Event type is required',
        field: 'event_type',
        severity: 'critical'
      })
    }

    if (!event.event_time) {
      errors.push({
        code: 'MISSING_EVENT_TIME',
        message: 'Event time is required',
        field: 'event_time',
        severity: 'critical'
      })
    }

    if (!event.epcis_document) {
      errors.push({
        code: 'MISSING_EPCIS_DOCUMENT',
        message: 'EPCIS document is required',
        field: 'epcis_document',
        severity: 'critical'
      })
    }

    // Validate event type
    const validEventTypes = ['ObjectEvent', 'AggregationEvent', 'TransactionEvent', 'TransformationEvent']
    if (event.event_type && !validEventTypes.includes(event.event_type)) {
      errors.push({
        code: 'INVALID_EVENT_TYPE',
        message: `Event type must be one of: ${validEventTypes.join(', ')}`,
        field: 'event_type',
        severity: 'error'
      })
    }

    // Validate event-specific required fields
    if (event.event_type === 'ObjectEvent') {
      if (!event.epc_list || (Array.isArray(event.epc_list) && event.epc_list.length === 0)) {
        errors.push({
          code: 'MISSING_EPC_LIST',
          message: 'ObjectEvent requires non-empty epc_list',
          field: 'epc_list',
          severity: 'error'
        })
      }
    }

    if (event.event_type === 'TransformationEvent') {
      if (!event.input_epc_list || (Array.isArray(event.input_epc_list) && event.input_epc_list.length === 0)) {
        errors.push({
          code: 'MISSING_INPUT_EPC_LIST',
          message: 'TransformationEvent requires non-empty input_epc_list',
          field: 'input_epc_list',
          severity: 'error'
        })
      }
      if (!event.output_epc_list || (Array.isArray(event.output_epc_list) && event.output_epc_list.length === 0)) {
        errors.push({
          code: 'MISSING_OUTPUT_EPC_LIST',
          message: 'TransformationEvent requires non-empty output_epc_list',
          field: 'output_epc_list',
          severity: 'error'
        })
      }
    }

    // Warnings for recommended fields
    if (!event.biz_step) {
      warnings.push({
        code: 'MISSING_BIZ_STEP',
        message: 'Business step (biz_step) is recommended',
        field: 'biz_step',
        suggestion: 'Add business step like "commissioning", "receiving", "shipping"'
      })
    }

    if (!event.read_point && !event.biz_location) {
      warnings.push({
        code: 'MISSING_LOCATION',
        message: 'Either read_point or biz_location should be specified',
        suggestion: 'Add GLN location reference'
      })
    }

    return { errors, warnings }
  }

  /**
   * Validate GS1 Identifiers (GTIN, GLN, SSCC)
   */
  private validateGS1Identifiers(event: any): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate EPCs in epc_list
    if (event.epc_list && Array.isArray(event.epc_list)) {
      for (const epc of event.epc_list) {
        const gtinMatch = epc.match(/\d{14}/)
        if (gtinMatch) {
          const gtin = gtinMatch[0]
          if (!validateGTIN(gtin)) {
            errors.push({
              code: 'INVALID_GTIN_CHECK_DIGIT',
              message: `Invalid GTIN check digit in EPC: ${epc}`,
              field: 'epc_list',
              severity: 'error'
            })
          }
        }
      }
    }

    // Validate GLN in locations
    if (event.read_point) {
      const glnMatch = event.read_point.match(/\d{13}/)
      if (glnMatch) {
        const gln = glnMatch[0]
        if (!validateGLN(gln)) {
          errors.push({
            code: 'INVALID_GLN_CHECK_DIGIT',
            message: `Invalid GLN check digit in read_point: ${event.read_point}`,
            field: 'read_point',
            severity: 'error'
          })
        }
      }
    }

    if (event.biz_location) {
      const glnMatch = event.biz_location.match(/\d{13}/)
      if (glnMatch) {
        const gln = glnMatch[0]
        if (!validateGLN(gln)) {
          errors.push({
            code: 'INVALID_GLN_CHECK_DIGIT',
            message: `Invalid GLN check digit in biz_location: ${event.biz_location}`,
            field: 'biz_location',
            severity: 'error'
          })
        }
      }
    }

    return { errors, warnings }
  }

  /**
   * Validate Business Rules
   */
  private async validateBusinessRules(event: any): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Rule 1: TransformationEvent must have mass balance validation with proper conversion factors
    if (event.event_type === 'TransformationEvent') {
      if (event.input_quantity_list && event.output_quantity_list) {
        // Get conversion factor from event metadata or use product recipe
        let expectedFactor = event.expected_conversion_factor || 
                            event.epcis_document?.ilmd?.conversionFactor
        let tolerance = event.conversion_tolerance || 10
        
        // If no conversion factor provided, try to get from product recipe
        if (!expectedFactor && event.product_id) {
          const recipe = await this.getProductRecipe(event.product_id)
          if (recipe) {
            expectedFactor = recipe.conversion_factor
            tolerance = recipe.tolerance || 10
          }
        }
        
        // Perform mass balance validation with conversion factor
        const validation = validateTransformationEvent({
          inputQuantities: event.input_quantity_list,
          outputQuantities: event.output_quantity_list,
          customConversionFactor: expectedFactor,
          tolerance
        })

        if (!validation.valid) {
          for (const anomaly of validation.anomalies) {
            errors.push({
              code: 'MASS_BALANCE_VIOLATION',
              message: anomaly,
              field: 'output_quantity_list',
              severity: 'critical'
            })
          }
        }

        for (const warning of validation.warnings) {
          warnings.push({
            code: 'MASS_BALANCE_WARNING',
            message: warning,
            suggestion: 'Review conversion ratios and input/output quantities'
          })
        }
        
        // Add actual conversion factor to warnings for transparency
        if (validation.conversionFactor < 50 || validation.conversionFactor > 110) {
          warnings.push({
            code: 'UNUSUAL_CONVERSION_FACTOR',
            message: `Conversion factor ${validation.conversionFactor.toFixed(1)}% is unusual`,
            suggestion: 'Verify if input/output quantities are correct'
          })
        }
      } else {
        warnings.push({
          code: 'MISSING_QUANTITIES',
          message: 'TransformationEvent should have input_quantity_list and output_quantity_list for mass balance validation',
          field: 'epc_list',
          suggestion: 'Add quantity information for better traceability'
        })
      }
    }

    // Rule 2: Event time cannot be in the future
    const eventTime = new Date(event.event_time)
    const now = new Date()
    if (eventTime > now) {
      errors.push({
        code: 'FUTURE_EVENT_TIME',
        message: 'Event time cannot be in the future',
        field: 'event_time',
        severity: 'error'
      })
    }

    // Rule 3: Event time should not be too old (> 1 year)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    if (eventTime < oneYearAgo) {
      warnings.push({
        code: 'OLD_EVENT_TIME',
        message: 'Event time is more than 1 year old',
        field: 'event_time',
        suggestion: 'Verify if this is correct'
      })
    }

    // Rule 4: Source type validation
    const validSourceTypes = ['voice_ai', 'vision_ai', 'manual', 'system']
    if (event.source_type && !validSourceTypes.includes(event.source_type)) {
      errors.push({
        code: 'INVALID_SOURCE_TYPE',
        message: `Source type must be one of: ${validSourceTypes.join(', ')}`,
        field: 'source_type',
        severity: 'error'
      })
    }

    // Rule 5: AI metadata should have confidence score for AI-sourced events
    if ((event.source_type === 'voice_ai' || event.source_type === 'vision_ai') && event.ai_metadata) {
      const confidenceScore = event.ai_metadata.confidence_score
      if (confidenceScore === undefined || confidenceScore === null) {
        warnings.push({
          code: 'MISSING_CONFIDENCE_SCORE',
          message: 'AI-generated events should have confidence score',
          field: 'ai_metadata',
          suggestion: 'Add confidence_score to ai_metadata'
        })
      } else if (confidenceScore < 0.7) {
        warnings.push({
          code: 'LOW_CONFIDENCE_SCORE',
          message: `Low confidence score: ${confidenceScore}`,
          field: 'ai_metadata',
          suggestion: 'Consider manual review'
        })
      }
    }

    return { errors, warnings }
  }

  /**
   * Validate Data Consistency
   */
  private validateDataConsistency(event: any): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check for duplicate EPCs in same list
    if (event.epc_list && Array.isArray(event.epc_list)) {
      const uniqueEpcs = new Set(event.epc_list)
      if (uniqueEpcs.size !== event.epc_list.length) {
        warnings.push({
          code: 'DUPLICATE_EPCS',
          message: 'EPC list contains duplicate values',
          field: 'epc_list',
          suggestion: 'Remove duplicates'
        })
      }
    }

    // Check input/output consistency for TransformationEvent
    if (event.event_type === 'TransformationEvent') {
      if (event.input_epc_list && event.output_epc_list) {
        // Check for overlapping EPCs (input and output should be different)
        const inputSet = new Set(event.input_epc_list)
        const outputSet = new Set(event.output_epc_list)
        const overlap = [...inputSet].filter(epc => outputSet.has(epc))
        
        if (overlap.length > 0) {
          errors.push({
            code: 'INPUT_OUTPUT_OVERLAP',
            message: 'Same EPC appears in both input and output lists',
            severity: 'error'
          })
        }
      }
    }

    // Check EPCIS document structure
    if (event.epcis_document) {
      if (!event.epcis_document['@context']) {
        warnings.push({
          code: 'MISSING_CONTEXT',
          message: 'EPCIS document missing @context',
          field: 'epcis_document',
          suggestion: 'Add @context: ["https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"]'
        })
      }

      if (event.epcis_document.schemaVersion !== '2.0') {
        warnings.push({
          code: 'INVALID_SCHEMA_VERSION',
          message: `EPCIS schema version should be 2.0, got ${event.epcis_document.schemaVersion}`,
          field: 'epcis_document.schemaVersion',
          suggestion: 'Update to EPCIS 2.0'
        })
      }
    }

    return { errors, warnings }
  }

  /**
   * Validate batch-level data
   */
  async validateBatch(batch: any): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate batch number format
    if (!batch.batch_number || typeof batch.batch_number !== 'string') {
      errors.push({
        code: 'INVALID_BATCH_NUMBER',
        message: 'Batch number is required and must be a string',
        field: 'batch_number',
        severity: 'error'
      })
    }

    // Validate quantities
    if (batch.quantity_produced && batch.quantity_available) {
      if (batch.quantity_available > batch.quantity_produced) {
        errors.push({
          code: 'QUANTITY_INCONSISTENCY',
          message: 'Available quantity cannot exceed produced quantity',
          field: 'quantity_available',
          severity: 'error'
        })
      }
    }

    // Validate dates
    if (batch.production_date && batch.expiry_date) {
      const prodDate = new Date(batch.production_date)
      const expDate = new Date(batch.expiry_date)
      
      if (expDate <= prodDate) {
        errors.push({
          code: 'INVALID_EXPIRY_DATE',
          message: 'Expiry date must be after production date',
          field: 'expiry_date',
          severity: 'error'
        })
      }
    }

    // Check for expired batches
    if (batch.expiry_date) {
      const expDate = new Date(batch.expiry_date)
      if (expDate < new Date()) {
        warnings.push({
          code: 'EXPIRED_BATCH',
          message: 'Batch has expired',
          field: 'expiry_date',
          suggestion: 'Review batch status'
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date().toISOString(),
        validatorVersion: this.version,
        rulesApplied: ['BATCH_VALIDATION']
      }
    }
  }

  /**
   * Get product recipe
   */
  private async getProductRecipe(productId: string): Promise<any> {
    // Placeholder for fetching product recipe logic
    return null
  }
}

// Export singleton instance
export const epcisValidator = new EPCISValidator()
