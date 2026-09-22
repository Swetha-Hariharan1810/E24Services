import { Injectable } from '@angular/core';

import { E24QuestionResponseDto, E24Answer, E24Literacy, E24WorkboxResponse, E24Asset, E24MeasureUnit, E24MeasureUnitValue, RecommendationDto, Conclusion, CarePlanGroupDto } from './e24.dtos';

@Injectable({
    providedIn: 'root'
})
export class E24MapperService {

    private TEXT_QUESTION: string                    = "question/text";
    private E24_TEXT_QUESTION: string                = "e24question/text";
    private MULTIPLE_CHOICE_SINGLE_ANSWER: string    = "multiple_choice_single_answer";
    private MULTIPLE_CHOICE_MULTIPLE_ANSWER: string  = "multiple_choice_multiple_answers";
    private RECOMMENDATION_DEFAULT: string           = "recommendation";
    private VALUEENTRY_QUESTION: string              = "question/value";
    private DEFAULT: string                          = "default";

    private POUNDS: string = "Pounds";
    private FEET: string   = "Feet";
    private INCHES: string = "Inches";
    private DAYS: string   = "Days";
    private MONTHS: string = "Months";
    private YEARS: string  = "Years";
    
    constructor() {
    }

    public mapE24responseToReportInformationConclusions(e24Response: any): Conclusion[] {

        return e24Response.Report.InformationConclusions;
    }

    public mapE24responseToAlertConclusions(e24Response: any): Conclusion[] {

        let alertConclusions: Conclusion[] = [];

        e24Response.Conclusions.forEach(conclusion => {

            if (this.isNotEmpty(conclusion) && conclusion.Category === 'Alert') {

                alertConclusions.push(conclusion);
            }
        });

        return alertConclusions;
    }

    public mapE24responseToCarePlanConclusions(e24Response: any): Conclusion[] {

        let carePlanConclusions: Conclusion[] = [];

        e24Response.Conclusions.forEach(conclusion => {

            if (this.isNotEmpty(conclusion) && conclusion.Category === 'Goal') {

                carePlanConclusions.push(conclusion);
            }
        });

        return carePlanConclusions;
    }

    public mapE24responseToDefaultConclusions(e24Response: any): Conclusion[] {

        let defaultConclusions: Conclusion[] = [];

        e24Response.Conclusions.forEach(conclusion => {

            if (this.isNotEmpty(conclusion) && conclusion.Category !== 'Goal'  && conclusion.Category !== 'Alert') {

                defaultConclusions.push(conclusion);
            }
        });

        return defaultConclusions;
    }

    public mapE24responseToContentVersion(e24Response: any): string {

        let version: string = null;

        e24Response.Conclusions.forEach(conclusion => {

            if (this.isNotEmpty(conclusion) && conclusion.Category === 'Default' && this.isNotEmpty(conclusion.Properties) ) {

                if (this.isNotEmpty(conclusion.Properties.CategoryProperties) ) {

                    if (conclusion.Properties.CategoryProperties.length === 1) {

                        if (conclusion.Properties.CategoryProperties[0].Name === 'Version') {
                        
                            version = conclusion.DisplayText;
                        }
                    }
                }
            }
        });

        return version;
    }

    public mapE24responseToHRAstatus(e24Response: any): string {

        let status: string = null;

        e24Response.Conclusions.forEach(conclusion => {

            if (this.isNotEmpty(conclusion) && conclusion.Category === 'Default' && this.isNotEmpty(conclusion.Properties) ) {

                if (this.isNotEmpty(conclusion.Properties.CategoryProperties) ) {

                    if (conclusion.Properties.CategoryProperties.length === 1) {

                        if (conclusion.Properties.CategoryProperties[0].Name === 'HRA Status') {
                        
                            status = conclusion.DisplayText;
                        }
                    }
                }
            }
        });

        return status;
    }

    public mapE24responseToCarePlanGroup(e24Response: any): CarePlanGroupDto {

        let group: CarePlanGroupDto = null;

        e24Response.Conclusions.forEach(conclusion => {

            if (this.isNotEmpty(conclusion) && conclusion.Category === 'Default' && this.isNotEmpty(conclusion.Properties) ) {

                if (this.isNotEmpty(conclusion.Properties.CategoryProperties) ) {

                    if (conclusion.Properties.CategoryProperties.length === 1) {

                        if (conclusion.Properties.CategoryProperties[0].Name === 'Track posting Care Plan') {
                        
                            group = new CarePlanGroupDto();
                            group.CarePlanGroupId = conclusion.Properties.CategoryProperties[0].Categories[0].Name;
                            group.CarePlanGroupName = conclusion.DisplayText;
                        }
                    }
                }
            }
        });

        return group;
    }

    public mapE24responseToAssessmentDto(e24NodeModel: E24QuestionResponseDto, traversalId: string, e24MemberId: string, e24AlgorithmId: string): E24WorkboxResponse {

        if (this.isNotEmpty(e24NodeModel) && this.isNotEmpty(e24NodeModel.Report)) // this is not a node model, it is a report model
        {
            return null;
        }

        if (this.isNotEmpty(e24NodeModel) && this.isEmpty(e24NodeModel.AlgoName)) // assessment was not found in the environment
        {
            return null;
        }

        let e24WorkboxResponse: E24WorkboxResponse = new E24WorkboxResponse();
        
        e24WorkboxResponse.algoId = e24NodeModel.AlgoID;
        e24WorkboxResponse.nodeId = e24NodeModel.NodeID;
        e24WorkboxResponse.ap_algorithm_id = e24AlgorithmId;
        e24WorkboxResponse.id = traversalId;
        e24WorkboxResponse.e24MemberId = e24MemberId;
        e24WorkboxResponse.percent_complete = '0';
        e24WorkboxResponse.traversalId = traversalId;
        e24WorkboxResponse.status = 'in_progress';
        
        let assets: E24Asset[] = [];;
        let asset: E24Asset = new E24Asset();

        let text: string = this.formatText(e24NodeModel.Questions[0].DisplayText);
        
        let literacy: E24Literacy = new E24Literacy();
        literacy.base = text;
        literacy.expert = text;
        literacy.lay = text;
        
        asset.ap_literacy = literacy;
        asset.is_non_visual = false; 
        asset.is_first_in_path = e24NodeModel.suppressBack;
        asset.is_required = true; // all questions are required
        asset.value = null;
        asset.type = this.RECOMMENDATION_DEFAULT;
        asset.sub_type = this.DEFAULT;
        asset.infoId = e24NodeModel.Questions[0].hasInfo ? e24NodeModel.Questions[0].QuestionID : null;
                
        let answers: E24Answer[] = [];
        let units: E24MeasureUnit = new E24MeasureUnit();
        let values: E24MeasureUnitValue[] = [];
        let i: number = 0;
        let checkbox: boolean = false;
        let valueEntry: boolean = false;

        e24NodeModel.Questions[0].Answers.forEach(answer => {

            let apAnswer: E24Answer = new E24Answer();
            apAnswer.id = String(answer.Index);
            apAnswer.answerId = answer.AnswerID;
            
            if (answer.hasInfo) {
                apAnswer.infoId = answer.AnswerID;
            }
            
            if (answer.ControlType.toLowerCase() === ('checkbox')) {
                
                apAnswer.type = this.MULTIPLE_CHOICE_MULTIPLE_ANSWER;
                asset.type = this.MULTIPLE_CHOICE_MULTIPLE_ANSWER;
                asset.sub_type = this.MULTIPLE_CHOICE_MULTIPLE_ANSWER;
                apAnswer.value_user_response = answer.isChecked;
                checkbox = true;

            } else if (answer.ControlType.toLowerCase() === ('radio')) {
            
                if (!checkbox && !valueEntry) {

                    apAnswer.type = this.MULTIPLE_CHOICE_SINGLE_ANSWER;
                    asset.type = this.MULTIPLE_CHOICE_SINGLE_ANSWER;
                    asset.sub_type = this.MULTIPLE_CHOICE_SINGLE_ANSWER;
                    apAnswer.value_user_response = answer.isChecked;

                } else {

                    if (!valueEntry) {

                        apAnswer.type = this.MULTIPLE_CHOICE_MULTIPLE_ANSWER;
                        apAnswer.value_user_response = answer.isChecked;
                        asset.sub_type = this.MULTIPLE_CHOICE_MULTIPLE_ANSWER;
                        apAnswer.is_exclusive = true;

                    } else {

                        if (answer.DisplayText.toLowerCase() === 'don\'t know' 
                            || answer.DisplayText.toLowerCase() === 'doesn\'t know'
                            || answer.DisplayText.toLowerCase() === 'does not know'
                            || answer.DisplayText.toLowerCase() === 'do not know') {

                            asset.has_dont_know_answer = true;

                            if (answer.isChecked) {
                                asset.value_user_response_dont_know_answer = true;
                            }

                        } else {

                            asset.has_decline_answer = true;

                            if (answer.isChecked) {
                                asset.value_user_response_decline_answer = true;
                            }
                        }
                    }
                }

            } else if (answer.ControlType.toLowerCase() === ('text') && answer.ControlSubType.toLowerCase() === ('number')) {

                asset.type = this.VALUEENTRY_QUESTION;
                asset.sub_type = this.VALUEENTRY_QUESTION;

                valueEntry = true;

                if (answer.DisplayText === this.FEET) {
                
                    let value: E24MeasureUnitValue = new E24MeasureUnitValue();
                    value.name = this.FEET;
                    value.value_minimum = 0;
                    value.value_maximum = 10;

                    if (this.isNotEmpty(answer.ControlValue)) {
                        value.value = Number(answer.ControlValue);
                    } else {
                        value.value = 0;
                    }

                    value.value_default = 0;
                    value.id = String(answer.Index);
                    values.push(value);

                } else if (answer.DisplayText === this.INCHES) {

                    let value: E24MeasureUnitValue = new E24MeasureUnitValue();
                    value.name = this.INCHES;
                    value.value_minimum = 0;
                    value.value_maximum = 12;

                    if (this.isNotEmpty(answer.ControlValue)) {
                        value.value = Number(answer.ControlValue);
                    } else {
                        value.value = 0;
                    }

                    value.value_default = 0;
                    value.id = String(answer.Index);
                    values.push(value);

                } else if (answer.DisplayText === this.POUNDS) {

                    let value: E24MeasureUnitValue = new E24MeasureUnitValue();
                    value.name = this.POUNDS;
                    value.value_minimum = 0;
                    value.value_maximum = 500;

                    if (this.isNotEmpty(answer.ControlValue)) {
                        value.value = Number(answer.ControlValue);
                    } else {
                        value.value = 0;
                    }

                    value.value_default = 200;
                    value.id = String(answer.Index);
                    values.push(value);
                }

            } else if (answer.ControlType.toLowerCase() === ('text')
                && answer.ControlType.toLowerCase() === ('date') 
                && answer.ControlType.toLowerCase() !== ('dob')) {

                asset.type = this.VALUEENTRY_QUESTION;
                asset.sub_type = this.DEFAULT;
                asset.value = String(answer.ControlValue);
                
                valueEntry = true;

                let value: E24MeasureUnitValue = new E24MeasureUnitValue();
                value.name = this.MONTHS;
                value.value_minimum = 9;
                value.value_maximum = 9;

                if (this.isNotEmpty(answer.ControlValue)) {
                
                    let dates: string[] = answer.ControlValue.split("-");
                    let month: string = dates[1];
                    value.value = Number(month);

                } else {
                    value.value = 0;
                }

                value.value_default = 0;
                value.id = String(answer.Index);
                values.push(value);

                value = new E24MeasureUnitValue();
                value.name = this.DAYS;
                value.value_minimum = 26;
                value.value_maximum = 27;

                if (this.isNotEmpty(answer.ControlValue)) {

                    let dates: string[] = answer.ControlValue.split("-");
                    let day: string = dates[2];
                    value.value = Number(day);

                } else {
                    value.value = 0;
                }

                value.value_default = 0;
                value.id = String(answer.Index);
                values.push(value);

                value = new E24MeasureUnitValue();
                value.name = this.YEARS;
                
                let currentYear: number = (new Date()).getFullYear();
                let next2Years: number = currentYear + 2;
                value.value_minimum = next2Years;
                value.value_maximum = currentYear;

                if (this.isNotEmpty(answer.ControlValue)) {
                
                    let dates: string[] = answer.ControlValue.split("-");
                    let year: string = dates[0];
                    value.value = Number(year);

                } else {
                    value.value = 0;
                }

                value.value_default = 0;
                value.id = String(answer.Index);
                values.push(value);

            } else {

                apAnswer.type = this.TEXT_QUESTION;
                asset.type = this.E24_TEXT_QUESTION;
                asset.sub_type = this.TEXT_QUESTION;
                asset.value = String(answer.ControlValue);
                apAnswer.value_user_response = null;
            }

            let answerLiteracy: E24Literacy = new E24Literacy();
            answerLiteracy.base = answer.DisplayText;
            apAnswer.ap_literacy = answerLiteracy;
            answers[i] = apAnswer;
            i++;
        });

        if (valueEntry) {

            let arrayValues: E24MeasureUnitValue[] = [];
            
            let j: number = 0;
            values.forEach(value => {
                arrayValues[j++] = value;
            });
            
            units.ap_measure_unit_values = arrayValues;
            let unitsArray: E24MeasureUnit[] = [];
            unitsArray.push(units);
            asset.ap_measure_units = unitsArray;
        }

        asset.ap_answers = answers;

        if (this.isNotEmpty(e24NodeModel.Questions[0].Properties)
            && this.isNotEmpty(e24NodeModel.Questions[0].Properties.guid)) {

            asset.id = String(e24NodeModel.Questions[0].Properties.guid.toLowerCase());

        } else {
            asset.id = String(e24NodeModel.Questions[0].QuestionID);
        }

        assets.push(asset);

        e24WorkboxResponse.ap_assets = assets;

        return e24WorkboxResponse;
    }

    private formatText(text: string): string {

        if (this.isEmpty(text)) {
            return null;
        }

        return text.replace("(\r\n|\n)", "<br/>");
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
