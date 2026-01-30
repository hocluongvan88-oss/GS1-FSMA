/**
 * EPCIS 2.0 Event Mapper
 * Maps AI-extracted data to GS1 EPCIS 2.0 compliant events
 */

import { parseAndValidateGS1 } from './gs1-parser'
import { validateGTIN, validateGLN } from './gs1-validation'

export interface AIExtractedData {
  // Voice/Vision AI output
  eventType?: string
  action?: string
  productName?: string
  quantity?: number
  unit?: string
  location?: string
  timestamp?: string
  barcodeData?: string
  
  // Additional metadata
  confidence?: number
  transcription?: string
  detectedObjects?: string[]
  imageUrl?: string
  audioUrl?: string
}

export interface EPCISEventInput {
  eventType: 'ObjectEvent' | 'AggregationEvent' | 'TransactionEvent' | 'TransformationEvent'
  eventTime: string
  
  // What
  epcList?: string[]
  quantityList?: Array<{
    epc: string
    quantity: number
    uom: string
  }>
  
  // Why
  bizStep: string
  disposition: string
  
  // Where
  readPoint?: string
  bizLocation?: string
  
  // Who
  userId: string
  userName: string
  
  // How
  sourceType: 'voice_ai' | 'vision_ai' | 'manual'
  
  // Transformation specific
  inputEpcList?: string[]
  outputEpcList?: string[]
  inputQuantityList?: Array<{
    epc: string
    quantity: number
    uom: string
  }>
  outputQuantityList?: Array<{
    epc: string
    quantity: number
    uom: string
  }>
  
  // AI metadata
  aiMetadata?: any
}

export interface EPCISEvent {
  event_type: string
  event_time: string
  event_timezone: string
  epc_list: any
  biz_step: string
  disposition: string
  read_point: string | null
  biz_location: string | null
  user_id: string
  user_name: string
  source_type: string
  input_epc_list: any
  output_epc_list: any
  input_quantity: any
  output_quantity: any
  ai_metadata: any
  epcis_document: any
}

/**
 * Map AI extracted data to EPCIS event structure
 */
export function mapAIDataToEPCIS(
  aiData: AIExtractedData,
  userId: string,
  userName: string,
  defaultLocation?: string
): EPCISEventInput | null {
  
  // Determine event type from AI data
  let eventType: EPCISEventInput['eventType'] = 'ObjectEvent'
  let bizStep = 'observing'
  let disposition = 'active'
  
  // Parse action keywords
  const action = aiData.action?.toLowerCase() || aiData.eventType?.toLowerCase() || ''
  
  if (action.includes('receive') || action.includes('nhận')) {
    bizStep = 'receiving'
    disposition = 'in_progress'
  } else if (action.includes('ship') || action.includes('gửi') || action.includes('xuất')) {
    bizStep = 'shipping'
    disposition = 'in_transit'
  } else if (action.includes('produce') || action.includes('sản xuất') || action.includes('chế biến')) {
    eventType = 'TransformationEvent'
    bizStep = 'commissioning'
    disposition = 'active'
  } else if (action.includes('pack') || action.includes('đóng gói')) {
    eventType = 'AggregationEvent'
    bizStep = 'packing'
    disposition = 'in_progress'
  } else if (action.includes('inspect') || action.includes('kiểm tra')) {
    bizStep = 'inspecting'
    disposition = 'active'
  }
  
  // Parse barcode if available
  let gs1Data: any = null
  if (aiData.barcodeData) {
    const parsed = parseAndValidateGS1(aiData.barcodeData)
    if (parsed.valid) {
      gs1Data = parsed.epcis
    }
  }
  
  // Build EPC list
  const epcList: string[] = []
  if (gs1Data?.epc) {
    epcList.push(gs1Data.epc)
  }
  
  // Build quantity list
  const quantityList: Array<{ epc: string; quantity: number; uom: string }> = []
  if (aiData.quantity && aiData.unit) {
    const epc = gs1Data?.epc || `urn:epc:id:sgtin:0000000.000000.${Date.now()}`
    quantityList.push({
      epc,
      quantity: aiData.quantity,
      uom: aiData.unit
    })
  }
  
  // Determine location
  let readPoint: string | undefined
  let bizLocation: string | undefined
  
  if (aiData.location) {
    // Try to match location name to GLN
    // In real implementation, query database for location by name
    bizLocation = defaultLocation
  } else {
    bizLocation = defaultLocation
  }
  
  const eventTime = aiData.timestamp || new Date().toISOString()
  
  const event: EPCISEventInput = {
    eventType,
    eventTime,
    epcList: epcList.length > 0 ? epcList : undefined,
    quantityList: quantityList.length > 0 ? quantityList : undefined,
    bizStep,
    disposition,
    readPoint,
    bizLocation,
    userId,
    userName,
    sourceType: aiData.imageUrl ? 'vision_ai' : 'voice_ai',
    aiMetadata: {
      confidence_score: aiData.confidence || 0,
      transcription: aiData.transcription,
      detected_objects: aiData.detectedObjects,
      image_url: aiData.imageUrl,
      audio_url: aiData.audioUrl,
      raw_ai_output: aiData
    }
  }
  
  return event
}

/**
 * Build EPCIS 2.0 JSON-LD document
 */
export function buildEPCISDocument(event: EPCISEventInput): any {
  const eventId = `urn:uuid:${crypto.randomUUID()}`
  
  const baseEvent = {
    eventID: eventId,
    eventTime: event.eventTime,
    eventTimeZoneOffset: '+07:00',
    recordTime: new Date().toISOString(),
    
    // What
    ...(event.epcList && { epcList: event.epcList }),
    ...(event.quantityList && {
      quantityList: event.quantityList.map(q => ({
        epcClass: q.epc,
        quantity: q.quantity,
        uom: q.uom
      }))
    }),
    
    // Why
    bizStep: `https://ns.gs1.org/voc/Bizstep-${event.bizStep}`,
    disposition: `https://ns.gs1.org/voc/Disp-${event.disposition}`,
    
    // Where
    ...(event.readPoint && {
      readPoint: { id: `urn:epc:id:sgln:${event.readPoint.replace(/\D/g, '')}.0` }
    }),
    ...(event.bizLocation && {
      bizLocation: { id: `urn:epc:id:sgln:${event.bizLocation.replace(/\D/g, '')}.0` }
    }),
    
    // Custom extensions
    ilmd: {
      recordedBy: event.userName,
      sourceSystem: event.sourceType,
      aiConfidence: event.aiMetadata?.confidence_score
    }
  }
  
  let eventObject: any
  
  switch (event.eventType) {
    case 'ObjectEvent':
      eventObject = {
        type: 'ObjectEvent',
        action: 'OBSERVE',
        ...baseEvent
      }
      break
      
    case 'AggregationEvent':
      eventObject = {
        type: 'AggregationEvent',
        action: 'ADD',
        parentID: event.epcList?.[0] || '',
        childEPCs: event.epcList?.slice(1) || [],
        ...baseEvent
      }
      break
      
    case 'TransactionEvent':
      eventObject = {
        type: 'TransactionEvent',
        action: 'ADD',
        bizTransactionList: [],
        ...baseEvent
      }
      break
      
    case 'TransformationEvent':
      eventObject = {
        type: 'TransformationEvent',
        inputEPCList: event.inputEpcList || [],
        inputQuantityList: event.inputQuantityList?.map(q => ({
          epcClass: q.epc,
          quantity: q.quantity,
          uom: q.uom
        })) || [],
        outputEPCList: event.outputEpcList || [],
        outputQuantityList: event.outputQuantityList?.map(q => ({
          epcClass: q.epc,
          quantity: q.quantity,
          uom: q.uom
        })) || [],
        ...baseEvent
      }
      break
  }
  
  const epcisDocument = {
    '@context': [
      'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'
    ],
    type: 'EPCISDocument',
    schemaVersion: '2.0',
    creationDate: new Date().toISOString(),
    epcisBody: {
      eventList: [eventObject]
    }
  }
  
  return epcisDocument
}

/**
 * Convert EPCISEventInput to database event structure
 */
export function toDatabaseEventStructure(event: EPCISEventInput): EPCISEvent {
  const epcisDocument = buildEPCISDocument(event)
  
  return {
    event_type: event.eventType,
    event_time: event.eventTime,
    event_timezone: 'Asia/Ho_Chi_Minh',
    epc_list: event.epcList || null,
    biz_step: event.bizStep,
    disposition: event.disposition,
    read_point: event.readPoint || null,
    biz_location: event.bizLocation || null,
    user_id: event.userId,
    user_name: event.userName,
    source_type: event.sourceType,
    input_epc_list: event.inputEpcList || null,
    output_epc_list: event.outputEpcList || null,
    input_quantity: event.inputQuantityList || null,
    output_quantity: event.outputQuantityList || null,
    ai_metadata: event.aiMetadata,
    epcis_document: epcisDocument
  }
}

/**
 * Complete mapping pipeline: AI data -> EPCIS event -> Database structure
 */
export function mapAIToDatabase(
  aiData: AIExtractedData,
  userId: string,
  userName: string,
  defaultLocation?: string
): EPCISEvent | null {
  
  const epcisInput = mapAIDataToEPCIS(aiData, userId, userName, defaultLocation)
  
  if (!epcisInput) {
    return null
  }
  
  return toDatabaseEventStructure(epcisInput)
}
