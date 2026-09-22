import { Injectable } from '@angular/core';
import { ApAnswerModel, ApAssessmentLiteracyModel, ApAssessmentPreviousAnswerDTO, ApMeasureUnitValues, ApPriorAnswerModel, ApResponseAsset, AssessmentDto, ASSESSMENT_STATUS, QuestionDto, QUESTION_TYPE, ResponseUOMDto } from './assessment-ctrl.dtos';

import { E24WorkboxResponse } from './e24.dtos';

@Injectable({
    providedIn: 'root'
})
export class AssessmentMapperService {

    private TEXT_QUESTION: string                   = 'question/text';
    private E24_TEXT_QUESTION: string               = 'e24question/text';
    private MULTIPLE_CHOICE_SINGLE_ANSWER: string   = 'multiple_choice_single_answer';
    private MULTIPLE_CHOICE_MULTIPLE_ANSWER: string = 'multiple_choice_multiple_answers';
    private RECOMMENDATION_DEFAULT: string          = 'recommendation';
    private VALUEENTRY_QUESTION: string             = 'question/value';
    private YES_NO_QUESTION: string                 = "yes_no";
    private PREGNANCY_DUE_DATE_ID: string           = "69194ba6-34fe-4211-a02e-b2f2e1e59716";
    private DEFAULT: string                         = 'default';

    private POUNDS: string = 'Pounds';
    private FEET: string   = 'Feet';
    private INCHES: string = 'Inches';
    private DAYS: string   = 'Days';
    private MONTHS: string = 'Months';
    private YEARS: string  = 'Years';
    
    constructor() {
    }

    public mapE24responseToAssessmentDto(e24WorkboxResponse: E24WorkboxResponse): AssessmentDto {

        let apAssessmentResponseModel: AssessmentDto = new AssessmentDto();

        if (this.isEmpty(e24WorkboxResponse)) {

            apAssessmentResponseModel.assessmentStatus = ASSESSMENT_STATUS.COMPLETE;

        } else {

            // don't have a memberAssessmentId for standalone mode
            // apAssessmentResponseModel.setMemberAssessmentId(String.valueOf(dto.getMemberAssessmentId()));   

            apAssessmentResponseModel.e24MemberId = e24WorkboxResponse.e24MemberId;
            apAssessmentResponseModel.nodeId = e24WorkboxResponse.nodeId;
            apAssessmentResponseModel.algoId = e24WorkboxResponse.algoId;
            apAssessmentResponseModel.traversalId = e24WorkboxResponse.traversalId;
            
            let questionModel: QuestionDto = new QuestionDto();       

            if (this.isNotEmpty(e24WorkboxResponse.ap_assets)) {

                let apAsset: ApResponseAsset = e24WorkboxResponse.ap_assets[0];
                apAsset.is_non_visual; // ?? no assignment or use
                let questionLiteracyModel: ApAssessmentLiteracyModel = new ApAssessmentLiteracyModel();
        
                if (this.isNotEmpty(apAsset.ap_literacy)) {
                    questionLiteracyModel.baseText = this.replaceNewline(apAsset.ap_literacy.base);
                    questionLiteracyModel.expertText = this.replaceNewline(apAsset.ap_literacy.expert);
                    questionLiteracyModel.layText = this.replaceNewline(apAsset.ap_literacy.lay);
                }
        
                questionModel.questionText = questionLiteracyModel;
                questionModel.questionId = apAsset.id;
                questionModel.helpText = apAsset.help_text;
                questionModel.infoId = apAsset.infoId;
                questionModel.isRequired = apAsset.is_required;
                questionModel.hasDontKnowAnswer = apAsset.has_dont_know_answer;
                questionModel.hasDontKnowResponse = apAsset.value_user_response_dont_know_answer;
                questionModel.hasDeclineAnswer = apAsset.has_decline_answer;
                questionModel.hasDeclineResponse = apAsset.value_user_response_decline_answer;

                if (apAsset.is_first_in_path) {                    
                    apAssessmentResponseModel.assessmentStatus = ASSESSMENT_STATUS.START;
                } else if (e24WorkboxResponse.status.toLowerCase() === 'complete') {                    
                    apAssessmentResponseModel.assessmentStatus = ASSESSMENT_STATUS.READY_TO_SUBMIT;
                } else {
                    apAssessmentResponseModel.assessmentStatus = ASSESSMENT_STATUS.IN_PROGRESS;
                }

                if (this.PREGNANCY_DUE_DATE_ID === apAsset.id) {
                    questionModel.isPregnancyDueDateQuestion = true;
                } else {
                    questionModel.isPregnancyDueDateQuestion = false;
                }

                if (apAsset.type.toLowerCase() === this.TEXT_QUESTION) {

                    questionModel.questionType = QUESTION_TYPE.FREE_TEXT;
                    
                    // text answer user response
                    if (this.isNotEmpty(apAsset.value) && apAsset.value.trim().length > 0) {

                        let answerModel: ApAnswerModel = new ApAnswerModel();
                        answerModel.userResponse = apAsset.value;
                        apAssessmentResponseModel.answerList.push(answerModel);
                    }

                } else if (apAsset.sub_type.toLowerCase() === this.MULTIPLE_CHOICE_SINGLE_ANSWER 
                    || apAsset.sub_type.toLowerCase() === this.YES_NO_QUESTION) {
                    
                    questionModel.questionType = QUESTION_TYPE.MULTIPLE_CHOICE_SINGLE_SELECT;

                } else if (apAsset.sub_type.toLowerCase() === this.MULTIPLE_CHOICE_MULTIPLE_ANSWER) {
                    
                    questionModel.questionType = QUESTION_TYPE.MULTIPLE_CHOICE_MULTIPLE_SELECT;

                } else if (apAsset.type.toLowerCase() === this.RECOMMENDATION_DEFAULT
                    && apAsset.sub_type.toLowerCase() === this.DEFAULT && apAsset.is_non_visual === false) {

                    questionModel.questionType = QUESTION_TYPE.RECOMMENDATION_DEFAULT;

                } else if (apAsset.type.toLowerCase() === this.VALUEENTRY_QUESTION) {

                    for (let i = 0; i < apAsset.ap_measure_units[0].ap_measure_unit_values.length; i++) {

                        let apUOMModel: ResponseUOMDto = new ResponseUOMDto();
                        let apMeasureUnitValues: ApMeasureUnitValues = apAsset.ap_measure_units[0].ap_measure_unit_values[i];

                        if (this.POUNDS.toLowerCase() === apMeasureUnitValues.name.toLowerCase()) {

                            questionModel.questionType = QUESTION_TYPE.VALUEENTRY_WEIGHT;
                            apUOMModel = this.createUomModel(apMeasureUnitValues);
                            questionModel.responseUOM.push(apUOMModel);
                            questionModel.responseMeasureUnit = apAsset.ap_measure_units[0].id;

                        } else if (this.FEET.toLowerCase() === apMeasureUnitValues.name.toLowerCase()) {

                            questionModel.questionType = QUESTION_TYPE.VALUEENTRY_HEIGHT;
                            apUOMModel = this.createUomModel(apMeasureUnitValues);
                            questionModel.responseUOM.push(apUOMModel);
                            questionModel.responseMeasureUnit = apAsset.ap_measure_units[0].id;

                        } else if (this.INCHES.toLowerCase() === apMeasureUnitValues.name.toLowerCase()) {

                            questionModel.questionType = QUESTION_TYPE.VALUEENTRY_HEIGHT;
                            apUOMModel = this.createUomModel(apMeasureUnitValues);
                            questionModel.responseUOM.push(apUOMModel);
                            questionModel.responseMeasureUnit = apAsset.ap_measure_units[0].id;

                        } else if ((this.MONTHS.toLowerCase() === apMeasureUnitValues.name.toLowerCase())
                            || (this.DAYS.toLowerCase() === apMeasureUnitValues.name.toLowerCase())
                            || (this.YEARS.toLowerCase() === apMeasureUnitValues.name.toLowerCase())) {

                            questionModel.questionType = QUESTION_TYPE.VALUEENTRY_DATE;
                            apUOMModel = this.createUomModel(apMeasureUnitValues);
                            questionModel.responseUOM.push(apUOMModel);
                            questionModel.responseMeasureUnit = apAsset.ap_measure_units[0].id;

                        } else {
                            questionModel.questionType = QUESTION_TYPE.FREE_TEXT;
                        }
                    }

                } else {
                    questionModel.questionType = QUESTION_TYPE.FREE_TEXT;
                }

                // For Answers
                if (this.isNotEmpty(apAsset.ap_answers) && apAsset.ap_answers.length > 0) {

                    apAsset.ap_answers.forEach(apAnswerAsset => {

                        let answerLiteracyModel: ApAssessmentLiteracyModel = new ApAssessmentLiteracyModel();
                        answerLiteracyModel.baseText = apAnswerAsset.ap_literacy.base;
                        answerLiteracyModel.expertText = apAnswerAsset.ap_literacy.expert;
                        answerLiteracyModel.layText = apAnswerAsset.ap_literacy.lay;
                        
                        let answerModel: ApAnswerModel = new ApAnswerModel();
                        answerModel.answerText = answerLiteracyModel;
                        answerModel.answerId = apAnswerAsset.id;
                        answerModel.helpText = apAnswerAsset.help_text;
                        answerModel.infoId = apAnswerAsset.infoId;

                        if (answerLiteracyModel.baseText.toLowerCase().includes('<b>')) {
                            answerModel.isToBeBold = true;
                            answerLiteracyModel.baseText = answerLiteracyModel.baseText.replace('<b>', '').replace('</b>', '');
                        }

                        if (this.isEmpty(apAnswerAsset.value_user_response)) {
                            answerModel.userResponse = apAsset.value;
                        } else if (apAnswerAsset.value_user_response) {
                            answerModel.userResponse = 'TRUE';
                        } else {
                            answerModel.userResponse = 'FALSE';
                        }

                        if (apAnswerAsset.is_exclusive) {
                            answerModel.isExclusive = true;
                        } else {
                            answerModel.isExclusive = false;
                        }

                        apAssessmentResponseModel.answerList.push(answerModel);
                    });
                }
            }

            apAssessmentResponseModel.question = questionModel;
        }

        // this.createPreviousAnswerModel(dto.getApAssessmentPreviousAnswerList(), apAssessmentResponseModel);

        return apAssessmentResponseModel;
    }

    private createUomModel(apMeasureUnitValues: ApMeasureUnitValues): ResponseUOMDto {

        let apUOMModel: ResponseUOMDto = new ResponseUOMDto();

        apUOMModel.id = apMeasureUnitValues.id;
        apUOMModel.uom = apMeasureUnitValues.name;
        
        if (this.isNotEmpty(apMeasureUnitValues.value)) {
            apUOMModel.value = String(apMeasureUnitValues.value);
        }

        apUOMModel.value_default = apMeasureUnitValues.value_default;
        apUOMModel.value_maximum = apMeasureUnitValues.value_maximum - 1;
        apUOMModel.value_minimum = apMeasureUnitValues.value_minimum;
        
        return apUOMModel;
    }

    private createPreviousAnswerModel(listOfPreviousAnswerDtos: ApAssessmentPreviousAnswerDTO[], assessmentModel: AssessmentDto) {

        if (this.isNotEmpty(listOfPreviousAnswerDtos) && listOfPreviousAnswerDtos.length > 0) {

            listOfPreviousAnswerDtos.forEach(priorAnswerDto => {                
            // for (ApAssessmentPreviousAnswerDTO priorAnswerDto : listOfPreviousAnswerDtos) {

                let answerModel: ApPriorAnswerModel = new ApPriorAnswerModel();

                let answerLiteracyModel: ApAssessmentLiteracyModel = new ApAssessmentLiteracyModel();
                answerLiteracyModel.baseText = priorAnswerDto.answerDesc;
                answerModel.answerText = answerLiteracyModel;
                answerModel.assessmentCompletedDate = priorAnswerDto.lastAssessmentCompletionDateAsString;

                assessmentModel.priorAnswerList.push(answerModel);
            });
        }
    }

    private replaceNewline(text: string): string {

        let result: string = null;

        if (this.isNotEmpty(text)) {

            result = text.trim();

            result = result.replace(/(?:\r\n|\r|\n)/g, '<br>');

            result = result.replace('<br><br>', '<br>');

            if (result.endsWith('<br>') && result.length > 4) {
                result = result.substring(0, result.length - 4);
            }
        }

        return result;
    }

    private isNotEmpty(object: any): boolean {

        if (object === null || object === undefined) {
            return false;
        } else if (typeof object === 'string' && object.trim().length === 0) {
            return false;
        }
        return true;
    }

    private isEmpty(object: any): boolean {

        if (object === null || object === undefined) {
            return true;
        } else if (typeof object === 'string' && object.trim().length === 0) {
            return true;
        }
        return false;
    }
}
