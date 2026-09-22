
import { Component, ViewEncapsulation, OnInit, OnDestroy, Input, Output, EventEmitter, isDevMode } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { AssessmentDto, AnswerRequestDto, QUESTION_TYPE, ASSESSMENT_STATUS, AssessmentErrorDto, AnswerResponseDto } from './assessment-ctrl.dtos';
import { AssessmentApiClient } from './assessment-api-client';
import { AssessmentMapperService } from './assessment-mapper.service';
import { E24HttpService } from './e24-http.service';
import { E24ProxyHttpService } from './e24-proxy-http.service';

import { AnsweredQuestionDto, AssessmentFinalDto, CarePlanGroupDto, Conclusion, E24WorkboxResponse, RecommendationDto, E24MemberIdTraversalIdDto } from './e24.dtos';
import { E24MapperService } from './e24-mapper.service';

@Component({
    selector: 'assmnt-assessment-ctrl',
    templateUrl: './assessment-ctrl.component.html',
    styleUrls: ['assessment-ctrl.component.css'],
    encapsulation: ViewEncapsulation.None,
    providers: [ConfirmationService, E24MapperService, AssessmentMapperService]
})
export class AssessmentCtrlComponent implements OnInit, OnDestroy {

    @Input() public memberId: string = '';
    @Input() public language: string = '';
    @Input() public assessmentName: string = '';
    @Input() public assessmentStartPrepop: string = '';
    @Input() public assessmentAlgorithmId: string = '';
    @Input() public webserviceUrlBase: string = '';
    @Input() public e24UrlBase: string = '';
    @Input() public useE24ProxyApi: boolean = true;
    @Input() public assessmentCompletedLabel: string | null = null;
    @Input() public showAssessmentCompletedLabel: boolean = true;
    @Input() public e24TraversalId: string = '';
    @Input() public e24MemberId: string = '';

    @Output() public assessmentTraversalIdSet = new EventEmitter<E24MemberIdTraversalIdDto >();    
    @Output() public assessmentIsComplete = new EventEmitter<AssessmentFinalDto>();    
    @Output() public assessmentErrorOccurred = new EventEmitter<AssessmentErrorDto>();

    // UI display controls
    public dontKnowAnswerValue: string = 'dontKnowAnswerValue';
    public declineAnswerValue: string = 'declineAnswerValue';
    public dontKnowDeclineAnswerValue: string | null = null;
    public hasDontKnowAnswerDisabled: boolean = false;
    public hasDeclineAnswerDisabled: boolean = false;
    public disableQuestion: boolean = false;
    public isLoading: boolean = false;
    public isAssessmentComplete: boolean = false;
    public isRequired: boolean = false;
    public waitingLaunch: boolean = false;
    public setMargin: string = '10px';

    public assessmentStatus: string = '';
    public apAssessmentDto: AssessmentDto = new AssessmentDto();

    private e24NodeId: number = 0;
    private e24CurrentAlgoId: string = '';
   
    // Answers from previous pending/completed assessment
    private previousAnswerList: String[] = [];
    private previousAnswerText: string | null = null;
    public providedAnswerList: String[] = [];
    public providedAnswerText: string | null = null;
    public priorAssessmentAnswer: any;

    public questionType: string = '';
    private questionId: string = '';
    public answerList: AnswerRequestDto[] = [];

    // For value entry height/weight questions
    public providedFeet: string | null = null;
    public providedInches: string | null = null;
    private providedAppointmentMonth: string | null = null;
    private providedAppointmentDay: string | null = null;
    private providedAppointmentYear: string | null = null;
    public pcpAppointmentDate: Date = new Date();

    index: number = -1;

    public showHelpDialog: boolean = false;
    public showHelpText: string = '';

    public nodeIdOfFirstQuestion: number = 0;

    public loadingLabel: string = '';
    public previousLabel: string = '';
    public nextLabel: string = '';
    public helpDialogTitleLabel: string = '';
    public dontKnowLabel: string = '';
    public declineLabel: string = '';
    public decimalsLabel: string = '';
    public minmaxLabel: string = '';
    public theLabel: string = '';
    public readOnlyLabel: string = '';
    public hasBeenSavedLabel: string = '';
    private hasBeenCompletedLabel: string = '';
    private noMemberIdMsgLabel: string = '';
    private noAlgorithmIdMsgLabel: string = '';
    private noUrlLabel: string = '';
    private questionIsRequiredMsgLabel: string = '';
    private questionIsRequiredTitleLabel: string = '';
    private valueForLabel: string = '';
    private valueForAndLabel: string = '';
    private mustBeBetweenLabel: string = '';
    private pregnancyDueDateLabel: string = '';
    private provideDateLabel: string = '';

    private navigateToNextSubscription: Subscription | null = null;
    private navigateToPreviousSubscription: Subscription | null = null;
    private startNewAssessmentSubscription: Subscription | null = null;
    private beginContinueAssessmentSubscription: Subscription | null = null;
    private continueAssessmentSubscription: Subscription | null = null;
    private firstQuestionSubscription: Subscription | null = null;
    private getInfoSubscription: Subscription | null = null;
    private getCompletionDataSubscription: Subscription | null = null;

    constructor(private _e24ProxyHttpService: E24ProxyHttpService,
                private _e24HttpService: E24HttpService,
                private _e24MapperService: E24MapperService,
                private _assessmentMapperService: AssessmentMapperService,
                private _confirmationService: ConfirmationService) {
    }

    private getAssessmentApiClient(): AssessmentApiClient {
        return this.useE24ProxyApi ? this._e24HttpService : this._e24ProxyHttpService;
    }

    public ngOnInit() {

        this.log('initializing assessment control with memberId: ' + this.memberId + ', assessmentAlgorithmId: ' + this.assessmentAlgorithmId);
        this.log('initializing assessment control with e24TraversalId: ' + this.e24TraversalId + ', e24MemberId: ' + this.e24MemberId);

        this.setLabels();

        let errDto: AssessmentErrorDto | null = null;

        if (!this.memberId) {

            errDto = new AssessmentErrorDto();
            errDto.message = this.noMemberIdMsgLabel;

        } else if (!this.assessmentAlgorithmId) {            
            
            errDto = new AssessmentErrorDto();
            errDto.message = this.noAlgorithmIdMsgLabel;

        } else if (!this.webserviceUrlBase) {            
            
            errDto = new AssessmentErrorDto();
            errDto.message = this.noUrlLabel;
        }

        if (errDto !== null) {
            this.assessmentErrorOccurred.emit(errDto);
            return;
        }


        if(this.isNotEmpty(this.e24TraversalId)  && this.isNotEmpty(this.e24MemberId) ){

            this.log('this.e24MemberId ' + this.e24MemberId);
            this.log('this.e24TraversalId  ' + this.e24TraversalId);
   
        }

        if(this.isNotEmpty(this.e24TraversalId) && this.isNotEmpty(this.e24MemberId)){
            this.log('Continue Assessment');
            this.beginContinueAssessment();       
        } else{
            this.log('Start Assessment');
            this.startAssessment();
        }

        
    }

    private beginContinueAssessment() {

        this.isLoading = true;
        this.waitingLaunch = true;
        this.clearDisplayData();

        this.beginContinueAssessmentSubscription?.unsubscribe();

        this.beginContinueAssessmentSubscription = this.getAssessmentApiClient().beginContinueAssessment(this.webserviceUrlBase, this.memberId, this.assessmentStartPrepop, this.e24MemberId, this.e24TraversalId, this.e24UrlBase).subscribe(
            response => {

                this.log('beginContinueAssessment() response: ' + JSON.stringify(response));
                this.continueAssessment();
            },
            error => {
                this.handleError('Could not begin continue assessment.', error);
            });
    }

    private continueAssessment() {

        this.continueAssessmentSubscription?.unsubscribe();

        this.continueAssessmentSubscription = this.getAssessmentApiClient().continueAssessment(this.webserviceUrlBase, this.e24MemberId, this.e24TraversalId, this.e24UrlBase).subscribe(
            response => {

                this.log('continueAssessment() response: ' + JSON.stringify(response));
                let mappedE24Response: E24WorkboxResponse = this._e24MapperService.mapE24responseToAssessmentDto(response, this.e24TraversalId, this.e24MemberId, this.assessmentAlgorithmId);
  
                this.log('first question mapped E24 response', mappedE24Response);

                if (this.isNotEmpty(response.Questions) && response.Questions.length > 0) {

                    if (response.Questions[0].DisplayText.indexOf('We have encountered a problem') === 0) {
                        this.handleError('One or more Prepop values were not supplied to the assessment.', response.Questions[0].DisplayText);
                    }
                }

                this.e24NodeId = response.NodeID;

                // note: as you go from question to question, the E24 Algo you are on can change, so need to capture it to use in submitting the next question
                this.e24CurrentAlgoId = String(response.AlgoID);

                this.apAssessmentDto = this._assessmentMapperService.mapE24responseToAssessmentDto(mappedE24Response);

                this.log('first question mapped apAssessmentDto', this.apAssessmentDto);

                this.nodeIdOfFirstQuestion = this.e24NodeId;

                if(this.isNotEmpty(this.e24TraversalId) && this.isNotEmpty(this.e24MemberId)){
                    let e24Dto:E24MemberIdTraversalIdDto = new E24MemberIdTraversalIdDto();
                    e24Dto.E24MemberId = this.e24MemberId;
                    e24Dto.E24TraversalId = this.e24TraversalId;
                    this.assessmentTraversalIdSet.emit(e24Dto);
                }

                this.prepareHelpText(this.apAssessmentDto);
                this.setValues(this.apAssessmentDto);
                this.setQuestionAnswers(this.apAssessmentDto);
                this.setPreviousAnswer(this.apAssessmentDto);

            },
            error => {
                this.handleError('Could not continue the assessment.', error);
            },
            () => {
                this.isLoading = false;
                this.waitingLaunch = false;
            });
    }

    private startAssessment() {

        this.isLoading = true;
        this.waitingLaunch = true;
        this.clearDisplayData();

        this.startNewAssessmentSubscription?.unsubscribe();

        this.startNewAssessmentSubscription = this.getAssessmentApiClient().startNewAssessment(this.webserviceUrlBase, this.memberId, this.assessmentStartPrepop, this.e24UrlBase).subscribe(
            response => {

                this.log('assessment start response', response);

                if (this.isNotEmpty(response.Table)) {

                    this.e24TraversalId = response.Table[0].TraversalID;
                    this.e24MemberId = response.Table[0].MemberID;
                
                } else {
                    this.handleError('Could not start the assessment.', null);
                }

                this.getFirstQuestion();
            },
            error => {
                this.handleError('Could not start the assessment.', error);
            });
    }

    private getFirstQuestion() {

        this.log('getting first question');

        this.firstQuestionSubscription?.unsubscribe();

        this.firstQuestionSubscription = this.getAssessmentApiClient().getFirstQuestion(this.webserviceUrlBase, this.e24TraversalId, this.e24MemberId, this.assessmentAlgorithmId, this.language, this.e24UrlBase).subscribe(
            response => {

                // this.log('first question response', response);

                if (this.isEmpty(response.Error)) {

                    if (this.isNotEmpty(response) && this.isNotEmpty(response.AlgoName)) {

                        let mappedE24Response: E24WorkboxResponse = this._e24MapperService.mapE24responseToAssessmentDto(response, this.e24TraversalId, this.e24MemberId, this.assessmentAlgorithmId);

                        this.log('first question mapped E24 response', mappedE24Response);

                        if (this.isNotEmpty(response.Questions) && response.Questions.length > 0) {

                            if (response.Questions[0].DisplayText.indexOf('We have encountered a problem') === 0) {
                                this.handleError('One or more Prepop values were not supplied to the assessment.', response.Questions[0].DisplayText);
                            }
                        }

                        this.e24NodeId = response.NodeID;

                        // note: as you go from question to question, the E24 Algo you are on can change, so need to capture it to use in submitting the next question
                        this.e24CurrentAlgoId = String(response.AlgoID);

                        this.apAssessmentDto = this._assessmentMapperService.mapE24responseToAssessmentDto(mappedE24Response);

                        this.log('first question mapped apAssessmentDto', this.apAssessmentDto);

                        this.nodeIdOfFirstQuestion = this.e24NodeId;

                        let e24Dto:E24MemberIdTraversalIdDto = new E24MemberIdTraversalIdDto();
                        e24Dto.E24MemberId = this.apAssessmentDto.e24MemberId;
                        e24Dto.E24TraversalId = this.apAssessmentDto.traversalId;

                        this.assessmentTraversalIdSet.emit(e24Dto);

                        this.prepareHelpText(this.apAssessmentDto);
                        this.setValues(this.apAssessmentDto);
                        this.setQuestionAnswers(this.apAssessmentDto);
                        this.setPreviousAnswer(this.apAssessmentDto);
                        
                    } else {
                    
                        this.handleError('Assessment ' + this.assessmentAlgorithmId + ' was not found on the Expert24 server', null);
                    }

                } else {
                    this.handleError('Could not get first question', response.Error);
                }
            },
            error => {
                this.handleError('Could not get first question', error);
            },
            () => {
                this.isLoading = false;
                this.waitingLaunch = false;
            });
    }

    public getNextQuestion() {

        if (this.isUserInputValid() === false) {

            this._confirmationService.confirm({
                message: this.questionIsRequiredMsgLabel,
                header: this.questionIsRequiredTitleLabel,
                rejectVisible: false
            });

        } else if (this.isUserInputInrange() === false) {

            this._confirmationService.confirm({
                message: this.getUserInputOutofRangeErrorMessage(),
                header: 'Validator Error',
                rejectVisible: false
            });

        } else {

            this.isLoading = true;
            this.showHelpDialog = false;

            let answerList: AnswerRequestDto[] = this.getAnswerList(this.providedAnswerList, this.providedAnswerText);

            let body: string | undefined = '';

            if (this.isNotEmpty(answerList) && answerList.length > 0) {

                answerList.forEach(answer => {

                    if (this.isNotEmpty(answer.answerText)) {

                        body = body + '"' + answer.answerId + '":"' + answer.answerText + '",'; 

                    } else {

                        body = body + '"' + answer.answerId + '":"",'; 
                    }
                });

                if (body.length > 0) {
                    body = '{' + body.substring(0, body.length - 1) + '}';
                } else {
                    body = undefined;
                }
                
            } else {
                body = undefined;
            }

            this.log('getting next question for traversal id: ' + this.e24TraversalId);

            if (this.navigateToNextSubscription !== null) {
                this.navigateToNextSubscription.unsubscribe();
            }
            
            this.navigateToNextSubscription = this.getAssessmentApiClient().navigateToNextQuestion(this.webserviceUrlBase, this.e24TraversalId, this.e24MemberId, this.e24CurrentAlgoId, this.e24NodeId, body, this.e24UrlBase).subscribe(
                response => {
                
                    if (this.isEmpty(response.Error)) {
                
                        this.e24NodeId = response.NodeID;

                        // note: as you go from question to question, the E24 Algo you are on can change, so need to capture it to use in submitting the next question
                        this.e24CurrentAlgoId = String(response.AlgoID);

                        let mappedE24Response: E24WorkboxResponse = this._e24MapperService.mapE24responseToAssessmentDto(response, this.e24TraversalId, this.e24MemberId, this.e24CurrentAlgoId);
                        this.log('next question mapped E24 response', mappedE24Response);

                        this.apAssessmentDto = this._assessmentMapperService.mapE24responseToAssessmentDto(mappedE24Response);                        
                        this.log('data for this question', this.apAssessmentDto);

                        if (this.isNotEmpty(response.Questions) && response.Questions.length > 0) {

                            if (response.Questions[0].DisplayText.indexOf('We have encountered a problem') === 0) {
                                this.handleError('One or more Prepop values were not supplied to the assessment.', response.Questions[0].DisplayText);
                            }
                        }
                
                        if (this.apAssessmentDto.assessmentStatus === ASSESSMENT_STATUS.COMPLETE) {
                            
                            this.log('this is the last question');

                            this.completeAssessment(response);
                            
                        } else {       

                            this.prepareHelpText(this.apAssessmentDto);
                            this.setValues(this.apAssessmentDto);
                            this.setQuestionAnswers(this.apAssessmentDto);
                            this.setPreviousAnswer(this.apAssessmentDto);

                            this.hasDontKnowAnswerDisabled = false;
                            this.dontKnowDeclineAnswerValue = null;
                            this.hasDeclineAnswerDisabled = false;
                            this.disableQuestion = false;

                            if (this.isNotEmpty(this.apAssessmentDto.question.questionType) 
                                && this.apAssessmentDto.question.questionType === QUESTION_TYPE.VALUEENTRY_HEIGHT) {

                                if (this.isNotEmpty(this.apAssessmentDto.question.hasDontKnowResponse) && this.apAssessmentDto.question.hasDontKnowResponse) {

                                    this.dontKnowDeclineAnswerValue = this.dontKnowAnswerValue;
                                    this.disableQuestion = true;

                                } else if ((this.isNotEmpty(this.providedFeet) && Number(this.providedFeet) !== 0)
                                        || (this.isNotEmpty(this.providedInches) && Number(this.providedInches) !== 0)) {
                                    this.hasDontKnowAnswerDisabled = true;
                                }

                                if (this.isNotEmpty(this.apAssessmentDto.question.hasDeclineResponse) 
                                    && this.apAssessmentDto.question.hasDeclineResponse) {

                                    this.dontKnowDeclineAnswerValue = this.declineAnswerValue;
                                    this.disableQuestion = true;

                                } else if ((this.isNotEmpty(this.providedFeet) && Number(this.providedFeet) !== 0)
                                    || (this.isNotEmpty(this.providedInches) && Number(this.providedInches) !== 0)) {
                                    this.hasDeclineAnswerDisabled = true;
                                }

                            } else if (this.isNotEmpty(this.apAssessmentDto.question.questionType)
                                && this.apAssessmentDto.question.questionType === QUESTION_TYPE.VALUEENTRY_WEIGHT) {

                                if (this.isNotEmpty(this.apAssessmentDto.question.hasDontKnowResponse) && this.apAssessmentDto.question.hasDontKnowResponse) {

                                    this.dontKnowDeclineAnswerValue = this.dontKnowAnswerValue;
                                    this.disableQuestion = true;

                                } else if (this.isNotEmpty(this.providedAnswerText) && Number(this.providedAnswerText) !== 0) {
                                    this.hasDontKnowAnswerDisabled = true;
                                }

                                if (this.isNotEmpty(this.apAssessmentDto.question.hasDeclineResponse) 
                                    && this.apAssessmentDto.question.hasDeclineResponse) {

                                    this.dontKnowDeclineAnswerValue = this.declineAnswerValue;
                                    this.disableQuestion = true;

                                } else if (this.isNotEmpty(this.providedAnswerText) && Number(this.providedAnswerText) !== 0) {
                                    this.hasDeclineAnswerDisabled = true;
                                }
                            }

                            this.isLoading = false;
                        }

                    } else {
                        this.handleError('Could not navigate to the next question.', response.Error);
                        this.isLoading = false;
                    }
                },
                error => {
                    let message = 'Could not navigate to the next question.';
                    this.handleError(message, error);
                    this.isLoading = false;
                });
        }
    }

    public getPreviousQuestion() {

        this.isLoading = true;
        this.showHelpDialog = false;

        if (this.navigateToPreviousSubscription !== null) {
            this.navigateToPreviousSubscription.unsubscribe();
        }
        
        this.navigateToPreviousSubscription = this.getAssessmentApiClient().navigateToPreviousQuestion(this.webserviceUrlBase, this.e24TraversalId, this.e24UrlBase).subscribe(
            response => {

                if (this.isEmpty(response.Error)) {

                    this.e24NodeId = response.NodeID;

                    // note: as you go from question to question, the E24 Algo you are on can change, so need to capture it to use in submitting the next question
                    this.e24CurrentAlgoId = String(response.AlgoID);
                    
                    let mappedE24Response: E24WorkboxResponse = this._e24MapperService.mapE24responseToAssessmentDto(response, this.e24TraversalId, this.e24MemberId, this.e24CurrentAlgoId);
                    this.log('previous question mapped E24 response', mappedE24Response);

                    this.apAssessmentDto = this._assessmentMapperService.mapE24responseToAssessmentDto(mappedE24Response);                        
                    this.log('data for previous question', this.apAssessmentDto);
                    
                    this.prepareHelpText(this.apAssessmentDto);
                    this.setValues(this.apAssessmentDto);
                    this.setQuestionAnswers(this.apAssessmentDto);
                    this.setPreviousAnswer(this.apAssessmentDto);

                    this.hasDontKnowAnswerDisabled = false;
                    this.dontKnowDeclineAnswerValue = null;
                    this.hasDeclineAnswerDisabled = false;
                    this.disableQuestion = false;

                    if (this.isNotEmpty(this.apAssessmentDto.question.questionType)
                        && this.apAssessmentDto.question.questionType === QUESTION_TYPE.VALUEENTRY_HEIGHT) {

                        if (this.isNotEmpty(this.apAssessmentDto.question.hasDontKnowResponse) && this.apAssessmentDto.question.hasDontKnowResponse) {

                            this.dontKnowDeclineAnswerValue = this.dontKnowAnswerValue;
                            this.disableQuestion = true;

                        } else if ((this.isNotEmpty(this.providedFeet) && Number(this.providedFeet) !== 0)
                                || (this.isNotEmpty(this.providedInches) && Number(this.providedInches) !== 0)) {
                            this.hasDontKnowAnswerDisabled = true;
                        }

                        if (this.isNotEmpty(this.apAssessmentDto.question.hasDeclineResponse) 
                            && this.apAssessmentDto.question.hasDeclineResponse) {

                            this.dontKnowDeclineAnswerValue = this.declineAnswerValue;
                            this.disableQuestion = true;

                        } else if ((this.isNotEmpty(this.providedFeet) && Number(this.providedFeet) !== 0)
                            || (this.isNotEmpty(this.providedInches) && Number(this.providedInches) !== 0)) {
                            this.hasDeclineAnswerDisabled = true;
                        }

                    } else if (this.isNotEmpty(this.apAssessmentDto.question.questionType)
                        && this.apAssessmentDto.question.questionType === QUESTION_TYPE.VALUEENTRY_WEIGHT) {

                        if (this.isNotEmpty(this.apAssessmentDto.question.hasDontKnowResponse) && this.apAssessmentDto.question.hasDontKnowResponse) {

                            this.dontKnowDeclineAnswerValue = this.dontKnowAnswerValue;
                            this.disableQuestion = true;

                        } else if (this.isNotEmpty(this.providedAnswerText) && Number(this.providedAnswerText) !== 0) {
                            this.hasDontKnowAnswerDisabled = true;
                        }

                        if (this.isNotEmpty(this.apAssessmentDto.question.hasDeclineResponse) 
                            && this.apAssessmentDto.question.hasDeclineResponse) {

                            this.dontKnowDeclineAnswerValue = this.declineAnswerValue;
                            this.disableQuestion = true;

                        } else if (this.isNotEmpty(this.providedAnswerText) && Number(this.providedAnswerText) !== 0) {
                            this.hasDeclineAnswerDisabled = true;
                        }
                    }

                } else {
                    this.handleError('Could not navigate to the previous question.', response.Error);                    
                }

                this.isLoading = false;
            },
            error => {
                let message = 'Could not navigate to the previous question.';
                this.handleError(message, error);
                this.isLoading = false;
            });
    }

    public showItemInfoText(infoId: number, type: boolean) {

        let noteTypeId: number = 32;
        if ( type) {
            noteTypeId = 64;
        }

        if (this.getInfoSubscription !== null) {
            this.getInfoSubscription.unsubscribe();
        }
        
        this.getInfoSubscription = this.getAssessmentApiClient().getItemInfoText(this.webserviceUrlBase, this.apAssessmentDto?.traversalId, infoId, noteTypeId, this.e24UrlBase).subscribe(
            response => {

                if (this.isNotEmpty(response) && this.isNotEmpty(response.Table[0]) && this.isNotEmpty(response.Table[0].Explanation)) {
            
                    let itemInfoText: string = response.Table[0].Explanation;

                    if (this.isNotEmpty(itemInfoText)) {

                        itemInfoText = itemInfoText.replace(/(?:\r\n|\r|\n)/g, '<br />');
                        this.showHelpText = itemInfoText;
                        this.showHelpDialog = true;
                    }
                }
            },
            error => {
                let message = 'Could not retrieve information text.';
                this.handleError(message, error);
            });
    }

    private completeAssessment(response: any) {
        
        this.isAssessmentComplete = true;

        if (this.assessmentCompletedLabel === null || this.assessmentCompletedLabel === undefined) {

            if (this.isNotEmpty(this.assessmentName)) {

                this.assessmentCompletedLabel = 'The ' + this.assessmentName + ' ' + this.hasBeenCompletedLabel;

            } else {

                this.assessmentCompletedLabel = 'The assessment ' + this.hasBeenCompletedLabel;
            }
        }

        let defaultReportInformationConclusions: Conclusion[] = this._e24MapperService.mapE24responseToReportInformationConclusions(response);
        let alertConclusions: Conclusion[] = this._e24MapperService.mapE24responseToAlertConclusions(response);
        let careplanConclusions: Conclusion[] = this._e24MapperService.mapE24responseToCarePlanConclusions(response);
        let defaultConclusions: Conclusion[] = this._e24MapperService.mapE24responseToDefaultConclusions(response);
        let contentVersion: string = this._e24MapperService.mapE24responseToContentVersion(response);
        let hraStatus: string = this._e24MapperService.mapE24responseToHRAstatus(response);
        let carePlanGroup: CarePlanGroupDto = this._e24MapperService.mapE24responseToCarePlanGroup(response);

        if (this.getCompletionDataSubscription !== null) {
            this.getCompletionDataSubscription.unsubscribe();
        }
        
        this.getCompletionDataSubscription = this.getAssessmentApiClient().getPostCompleteData(this.webserviceUrlBase, this.e24TraversalId, this.e24UrlBase).subscribe(
            response => {

                let finalDto: AssessmentFinalDto = new AssessmentFinalDto();
                finalDto.AssessmentName = this.assessmentName;
                finalDto.TraversalID = this.e24TraversalId;
                finalDto.AlgorithmID = this.e24CurrentAlgoId;
                finalDto.ContentVersion = contentVersion;
                finalDto.HRAstatus = hraStatus;
                finalDto.ReportInformationConclusions = defaultReportInformationConclusions;
                finalDto.AlertConclusions = alertConclusions;
                finalDto.CarePlanConclusions = careplanConclusions;
                finalDto.DefaultConclusions = defaultConclusions;

                if (this.isNotEmpty(carePlanGroup)) {
                    finalDto.CarePlanGroupId = carePlanGroup.CarePlanGroupId;
                    finalDto.CarePlanGroupName = carePlanGroup.CarePlanGroupName;
                }

                // process the questions and answers returned from the QA rest web service call
                response.Table.forEach((answeredQuestion: any) => {

                    let question: AnsweredQuestionDto = new AnsweredQuestionDto();

                    question.NodeID = answeredQuestion.NodeID;
                    question.QuestionID = answeredQuestion.QuestionID;
                    question.Question = answeredQuestion.Question;
                    question.AnsID = answeredQuestion.AnsID;

                    question.Answer = answeredQuestion.Answer;

                    if (this.isNotEmpty(answeredQuestion.SValue)) {
                    if (this.isNotEmpty(answeredQuestion.Answer)) {
                        
                        question.Answer = answeredQuestion.SValue + ' ' + answeredQuestion.Answer;
                    } else {
                        question.Answer = answeredQuestion.SValue;
                    }
                } else {
                    question.Answer = answeredQuestion.Answer;
                }
                    finalDto.Questions.push(question);
                });

                this.assessmentIsComplete.emit(finalDto);

                this.isLoading = false;
            },
            error => {
                let message = 'Could not get the completed questions and answers.';
                this.handleError(message, error);
                this.isLoading = false;
            });
    }

    public handleNoneOfAbove(e: any, answer: any) {

        if (answer.isExclusive && e) {

            this.providedAnswerList = [];
            this.providedAnswerList.push(answer.answerId);
            this.index = this.providedAnswerList.indexOf(answer.answerId);

        } else if (answer.isExclusive && !e) {

            this.providedAnswerList = [];

        } else {

            if (this.index > -1) {

                this.providedAnswerList = [];
                this.providedAnswerList.push(answer.answerId);
                this.index = -1;
            }
        }
    }

    public disableEnableQuestion(e: any) {

        if (this.isNotEmpty(this.dontKnowDeclineAnswerValue)) {
            this.disableQuestion = true;
        } else {
            this.disableQuestion = false;
        }

        if (this.isNotEmpty(this.dontKnowDeclineAnswerValue) && this.dontKnowDeclineAnswerValue === this.dontKnowAnswerValue) {
            
            let dontKnowAnswer: AnswerResponseDto | undefined = this.getDontKnowAnswer();

            this.providedAnswerList = [];

            if (dontKnowAnswer) {
                this.providedAnswerList.push(dontKnowAnswer.answerId);
            }
        }

        if (this.isNotEmpty(this.dontKnowDeclineAnswerValue) && this.dontKnowDeclineAnswerValue === this.declineAnswerValue) {
            
            let declineAnswer: AnswerResponseDto | undefined = this.getDeclineAnswer();

            this.providedAnswerList = [];

            if (declineAnswer) {
                this.providedAnswerList.push(declineAnswer.answerId);
            }
        }
    }

    public changeWeightSpinnerValue() {

        if (Number(this.providedAnswerText) === 0) {
            this.hasDontKnowAnswerDisabled = false;
            this.hasDeclineAnswerDisabled = false;
        } else {
            this.hasDontKnowAnswerDisabled = true;
            this.hasDeclineAnswerDisabled = true;
        }
    }

    public changeHeightSpinnerValue() {

        if (Number(this.providedFeet) === 0 && Number(this.providedInches) === 0) {
            this.hasDontKnowAnswerDisabled = false;
            this.hasDeclineAnswerDisabled = false;
        } else {
            this.hasDontKnowAnswerDisabled = true;
            this.hasDeclineAnswerDisabled = true;
        }
    }

    private setValues(assessmentDto: any) {

        this.assessmentStatus = assessmentDto.assessmentStatus;

        if (this.isNotEmpty(assessmentDto.question)) {
            
            this.questionId = assessmentDto.question.questionId;
            this.questionType = assessmentDto.question.questionType;
            this.isRequired = assessmentDto.question.isRequired;

        } else if (this.isNotEmpty(assessmentDto.questions) && assessmentDto.questions.length > 0) {
        
            this.questionId = assessmentDto.questions[0].questionId;
            this.questionType = assessmentDto.questions[0].questionType;
            this.isRequired = assessmentDto.questions[0].isRequired;
        }
    }

    private prepareHelpText(apAssessment: AssessmentDto) {

        if (this.isNotEmpty(apAssessment) && this.isNotEmpty(apAssessment.question) && this.isNotEmpty(apAssessment.question.helpText)) {

            apAssessment.question.helpText = apAssessment.question.helpText.replace(/(?:\r\n|\r|\n)/g, '<br />');
        }
    }

    private clearDisplayData() {

        this.apAssessmentDto = new AssessmentDto();
        this.showHelpDialog = false;
    }

    private getDontKnowAnswer(): AnswerResponseDto | undefined {

        return this.apAssessmentDto.answerList.find(a => 
            a.answerText.baseText.toLowerCase() === 'don\'t know'
            || a.answerText.baseText.toLowerCase() === 'doesn\'t know'
            || a.answerText.baseText.toLowerCase() === 'does not know'
            || a.answerText.baseText.toLowerCase() === 'do not know');
    }

    private getDeclineAnswer(): AnswerResponseDto | undefined {

        return this.apAssessmentDto.answerList.find(a => a.answerText.baseText.toLowerCase().startsWith('decline'));
    }

    private createAnswerList(providedAnswers: any, providedAnswerText: string | null): AnswerRequestDto[] {

        this.answerList = [];

        if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.FREE_TEXT]) {
            
            if ( this.apAssessmentDto.answerList !== null && this.apAssessmentDto.answerList !== undefined) {
                this.answerList.push({ answerId: this.apAssessmentDto.answerList[0].answerId, answerText: providedAnswerText });
            } else {
                this.answerList.push({ answerId: null, answerText: providedAnswerText });
            }

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_WEIGHT]) {

            if (this.isNotEmpty(this.dontKnowDeclineAnswerValue) && this.dontKnowDeclineAnswerValue === this.dontKnowAnswerValue) {
            
                let dontKnowAnswer: AnswerResponseDto | undefined = this.getDontKnowAnswer();
    
                if (dontKnowAnswer) {
                    this.answerList.push({ answerId: dontKnowAnswer.answerId, answerText: '' });
                }

            } else if (this.isNotEmpty(this.dontKnowDeclineAnswerValue) && this.dontKnowDeclineAnswerValue === this.declineAnswerValue) {
                
                let declineAnswer: AnswerResponseDto | undefined = this.getDeclineAnswer();
    
                if (declineAnswer) {
                    this.answerList.push({ answerId: declineAnswer.answerId, answerText: '' });
                }

            } else {

                this.answerList.push({ answerId: this.apAssessmentDto.question.responseUOM[0].id, answerText: providedAnswerText });
            } 

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_HEIGHT]) {

            if (this.isNotEmpty(this.dontKnowDeclineAnswerValue) && this.dontKnowDeclineAnswerValue === this.dontKnowAnswerValue) {
            
                let dontKnowAnswer: AnswerResponseDto | undefined = this.getDontKnowAnswer();
    
                if (dontKnowAnswer) {
                    this.answerList.push({ answerId: dontKnowAnswer.answerId, answerText: '' });
                }

            } else if (this.isNotEmpty(this.dontKnowDeclineAnswerValue) && this.dontKnowDeclineAnswerValue === this.declineAnswerValue) {
                
                let declineAnswer: AnswerResponseDto | undefined = this.getDeclineAnswer();
    
                if (declineAnswer) {
                    this.answerList.push({ answerId: declineAnswer.answerId, answerText: '' });
                }

            } else {

                this.answerList.push({ answerId: this.apAssessmentDto.question.responseUOM[0].id, answerText: this.providedFeet });
                this.answerList.push({ answerId: this.apAssessmentDto.question.responseUOM[1].id, answerText: this.providedInches });
            }            

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_DATE]) {

            this.providedAppointmentMonth = String(this.pcpAppointmentDate.getMonth() + 1);
            this.providedAppointmentDay = String(this.pcpAppointmentDate.getDate());
            this.providedAppointmentYear = String(this.pcpAppointmentDate.getFullYear());

            if ( this.apAssessmentDto.question.responseUOM[0].id === this.apAssessmentDto.question.responseUOM[1].id &&
                 this.apAssessmentDto.question.responseUOM[0].id === this.apAssessmentDto.question.responseUOM[2].id ) {

                 this.answerList.push(
                    { answerId: this.apAssessmentDto.question.responseUOM[0].id, answerText: this.providedAppointmentYear +
                            '-' + this.providedAppointmentMonth + '-' + this.providedAppointmentDay });           

            } else {

                this.answerList.push(
                    { answerId: this.apAssessmentDto.question.responseUOM[0].id, answerText: this.providedAppointmentMonth },
                    { answerId: this.apAssessmentDto.question.responseUOM[1].id, answerText: this.providedAppointmentDay },
                    { answerId: this.apAssessmentDto.question.responseUOM[2].id, answerText: this.providedAppointmentYear });
            }

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.MULTIPLE_CHOICE_SINGLE_SELECT]
            || this.questionType === QUESTION_TYPE[QUESTION_TYPE.MULTIPLE_CHOICE_MULTIPLE_SELECT]) {

            if (providedAnswers instanceof Array && providedAnswers.length > 0) {
                for (let i: number = 0; i < providedAnswers.length; i++) {
                    this.answerList.push({ answerId: providedAnswers[i], answerText: null });
                }
            } else if (providedAnswers instanceof Array && providedAnswers.length === 0) {
                this.answerList.push({ answerId: null, answerText: null });
            } else {
                this.answerList.push({ answerId: providedAnswers, answerText: null });
            }
        }       

        return this.answerList;
    }

    private getAnswerList(providedAnswers: any = null, providedAnswerText: string | null = null): AnswerRequestDto[] {

        if (providedAnswerText === '') {
            providedAnswerText = null;
        }

        if (this.providedFeet === '') {
            this.providedFeet = null;
        }

        if (this.providedInches === '') {
            this.providedInches = null;
        }

        if (this.providedAppointmentMonth === '') {
            this.providedAppointmentMonth = null;
        }

        if (this.providedAppointmentDay === '') {
            this.providedAppointmentDay = null;
        }

        if (this.providedAppointmentYear === '') {
            this.providedAppointmentYear = null;
        }

        if (this.isRequired && providedAnswers.length === 0 && providedAnswerText == null &&            
            this.apAssessmentDto.question.questionType !== QUESTION_TYPE.VALUEENTRY_DATE &&
            this.apAssessmentDto.question.questionType !== QUESTION_TYPE.VALUEENTRY_HEIGHT &&
            this.apAssessmentDto.question.questionType !== QUESTION_TYPE.VALUEENTRY_WEIGHT) {

            this.questionId = '';
        }

        return this.createAnswerList(providedAnswers, providedAnswerText)
    }

    private isUserInputInrange() {

        let isValidRange: boolean = true;

        if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_WEIGHT]) {

            isValidRange = (this.isNotEmpty(this.dontKnowDeclineAnswerValue)
                || this.checkUOMLimit(this.providedAnswerText, this.apAssessmentDto.question.responseUOM[0].value_minimum,
                    this.apAssessmentDto.question.responseUOM[0].value_maximum));

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_HEIGHT]) {

            isValidRange = ((this.isNotEmpty(this.dontKnowDeclineAnswerValue) || this.checkUOMLimit(this.providedFeet,
                this.apAssessmentDto.question.responseUOM[0].value_minimum,
                this.apAssessmentDto.question.responseUOM[0].value_maximum)) &&
                (this.isNotEmpty(this.dontKnowDeclineAnswerValue) 
                    || this.checkUOMLimit(this.providedInches, this.apAssessmentDto.question.responseUOM[1].value_minimum,
                        this.apAssessmentDto.question.responseUOM[1].value_maximum)));

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_DATE]) {

            if (this.apAssessmentDto.question.isPregnancyDueDateQuestion) {
                isValidRange = this.checkPregnancyDate();
            } else if (this.isRequired && (this.pcpAppointmentDate === null)) {
                isValidRange = false;
            }
        }

        return isValidRange;
    }

    private checkUOMLimit(providedAnswerText: string | number | null, minVal: number, maxVal: number): boolean {

        if (providedAnswerText === null) {
            return false;
        }

        const numericAnswer = Number(providedAnswerText);

        if (numericAnswer > maxVal || numericAnswer < minVal) {
            return false;
        } else {
            return true;
        }
    }

    private checkPregnancyDate(): boolean {

        let now: Date = new Date();

        let startMonth: number = now.getMonth() - 1;
        let endMonth: number = now.getMonth() + 10;

        let pregnancyDueDateStartRange: Date = new Date();
        pregnancyDueDateStartRange.setMonth(startMonth);

        let pregnancyDueDateEndRange: Date = new Date();
        pregnancyDueDateEndRange.setMonth(endMonth);

        if (this.pcpAppointmentDate < pregnancyDueDateStartRange) {
            return false;
        } else if (this.pcpAppointmentDate > pregnancyDueDateEndRange) {
            return false;
        } else {
            return true;
        }
    }

    private getUserInputOutofRangeErrorMessage() {

        let validationMessage: string = '';

        if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_WEIGHT]) {
            let maxLimitValue = Number(this.apAssessmentDto.question.responseUOM[0].value_maximum);
            let minLimitValue = this.apAssessmentDto.question.responseUOM[0].value_minimum;
            let uomValue = this.apAssessmentDto.question.responseUOM[0].uom;
            validationMessage = this.valueForLabel + ' ' + uomValue + ' ' + this.mustBeBetweenLabel + ' ' + minLimitValue + '-' + maxLimitValue;
        }

        if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_HEIGHT]) {
            validationMessage = this.valueForLabel + ' ' + this.apAssessmentDto.question.responseUOM[0].uom + ' ' + this.mustBeBetweenLabel + ' ' +
                this.apAssessmentDto.question.responseUOM[0].value_minimum + '-' +
                (Number(this.apAssessmentDto.question.responseUOM[0].value_maximum)) +
                ' ' + this.valueForAndLabel + ' ' + this.apAssessmentDto.question.responseUOM[1].uom +
                ' ' + this.mustBeBetweenLabel + ' ' + this.apAssessmentDto.question.responseUOM[1].value_minimum + '-' +
                (Number(this.apAssessmentDto.question.responseUOM[1].value_maximum)) + '.';
        }

        if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_DATE]) {
            if (this.apAssessmentDto.question.isPregnancyDueDateQuestion && !this.checkPregnancyDate()) {
                validationMessage = this.pregnancyDueDateLabel;
            } else {
                validationMessage = this.provideDateLabel;
            }
        }

        return validationMessage;
    }

    private isUserInputValid() {

        let isValidInput: boolean = true;

        if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.FREE_TEXT]) {
            
            if (this.providedAnswerText != null) {
                this.providedAnswerText = this.providedAnswerText.trim();
            }
            
            if (this.isRequired && (this.providedAnswerText == null || this.providedAnswerText === '')) {
                isValidInput = false;
            }

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.MULTIPLE_CHOICE_SINGLE_SELECT]
            || this.questionType === QUESTION_TYPE[QUESTION_TYPE.MULTIPLE_CHOICE_MULTIPLE_SELECT]) {

            if (this.isRequired && (this.providedAnswerList == null || this.providedAnswerList.length === 0)) {
                isValidInput = false;
            }

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_WEIGHT]) {
            
            if (this.isRequired && ((this.providedAnswerText == null || this.providedAnswerText === '') 
                && this.isEmpty(this.dontKnowDeclineAnswerValue))) {

                isValidInput = false;
            }

        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_DATE]) {
            /* if (this.isRequired && (this.pcpAppointmentDate === null)) {
                isValidInput = false;
             }*/
        } else if (this.questionType === QUESTION_TYPE[QUESTION_TYPE.VALUEENTRY_HEIGHT]) {
            
            let feetMax = this.apAssessmentDto.question.responseUOM[0].value_maximum;
            let feetMin = this.apAssessmentDto.question.responseUOM[0].value_minimum;
            let inchMax = this.apAssessmentDto.question.responseUOM[1].value_maximum;
            let inchMin = this.apAssessmentDto.question.responseUOM[1].value_minimum;
            
            if (this.isRequired && (((this.providedFeet == null || this.providedFeet === '')
                && (this.providedInches == null || this.providedInches === '') && this.isEmpty(this.dontKnowDeclineAnswerValue))
                || (Number(this.providedFeet) === 0 && Number(this.providedInches) === 0) && this.isEmpty(this.dontKnowDeclineAnswerValue))) {

                isValidInput = false;
            }
        }
        
        return isValidInput;
    }

    private setQuestionAnswers(apAssessmentDto: AssessmentDto) {

        this.providedAnswerText = null;
        this.providedAnswerList = [];
        this.previousAnswerText = null;
        this.previousAnswerList = [];

        if (this.questionType === QUESTION_TYPE.FREE_TEXT) {

            if (this.isNotEmpty(apAssessmentDto.answerList) && apAssessmentDto.answerList.length > 0) {
            
                this.providedAnswerText = apAssessmentDto.answerList[0].userResponse;
                this.previousAnswerText = apAssessmentDto.answerList[0].userResponse;
            }

        } else if (this.questionType === QUESTION_TYPE.MULTIPLE_CHOICE_SINGLE_SELECT
            || this.questionType === QUESTION_TYPE.MULTIPLE_CHOICE_MULTIPLE_SELECT) {

            if (this.isNotEmpty(apAssessmentDto.answerList)) {

                let filteredAnswer = apAssessmentDto.answerList.filter((answer: AnswerResponseDto) => {
                    return answer.userResponse === 'TRUE';
                });

                if (this.isNotEmpty(filteredAnswer) && filteredAnswer.length > 0) {

                    this.providedAnswerList = filteredAnswer.map((i: AnswerResponseDto) => i.answerId);
                    this.previousAnswerList = filteredAnswer.map((i: AnswerResponseDto) => i.answerId);
                }
            }

        } else if (this.questionType === QUESTION_TYPE.VALUEENTRY_WEIGHT) {
            
            this.providedAnswerText = apAssessmentDto.question.responseUOM[0].value;

        } else if (this.questionType === QUESTION_TYPE.VALUEENTRY_HEIGHT) {
            
            this.providedFeet = apAssessmentDto.question.responseUOM[0].value;
            this.providedInches = apAssessmentDto.question.responseUOM[1].value;

        } else if (this.questionType === QUESTION_TYPE.VALUEENTRY_DATE) {

            let pcpAppointmentMonth = apAssessmentDto.question.responseUOM[0].value;
            let pcpAppointmentDate = apAssessmentDto.question.responseUOM[1].value;
            let pcpAppointmentYear = apAssessmentDto.question.responseUOM[2].value;
            let pcpAppointmentCombinedDate = pcpAppointmentMonth + '/' + pcpAppointmentDate + '/' + pcpAppointmentYear;
            
            if (!((new Date(pcpAppointmentCombinedDate) === null) || (pcpAppointmentCombinedDate === '0/0/0'))) {
            
                this.pcpAppointmentDate = new Date(pcpAppointmentCombinedDate);
            }
        }
    }

    private answerTextIsDontKnow(answerText: string) {

        if (this.isEmpty(answerText)) {
            return false;
        }

        return (answerText === 'don\'t know' || answerText === 'doesn\'t know' || answerText === 'does not know' || answerText === 'do not know');
    }

    private answerTextIsDecline(answerText: string) {

        if (this.isEmpty(answerText)) {
            return false;
        }

        return answerText.startsWith('decline');
    }

    private setPreviousAnswer(apAssessmentDto: AssessmentDto) {

        if (apAssessmentDto.priorAnswerList) {

            if (this.questionType === QUESTION_TYPE.VALUEENTRY_HEIGHT) {

                if (this.answerTextIsDontKnow(apAssessmentDto.priorAnswerList[0]?.answerText.baseText.toLowerCase())) {
                
                    this.priorAssessmentAnswer = apAssessmentDto.priorAnswerList[0].answerText.baseText;
                
                } else if (this.answerTextIsDecline(apAssessmentDto.priorAnswerList[0]?.answerText.baseText.toLowerCase())) {
                
                    this.priorAssessmentAnswer = apAssessmentDto.priorAnswerList[0].answerText.baseText;
                
                } else {
                
                    let totalHeightInInches = Number(apAssessmentDto.priorAnswerList[0]?.answerText.baseText);
                    let heightInFeet = Math.floor(totalHeightInInches / 12);
                    let heightInInches = totalHeightInInches % 12;

                    this.priorAssessmentAnswer = null;
                    this.priorAssessmentAnswer = heightInFeet + ' ' + apAssessmentDto.question.responseUOM[0].uom + ' ' +
                        + heightInInches + ' ' + apAssessmentDto.question.responseUOM[1].uom;
                }

            } else if (this.questionType === QUESTION_TYPE.VALUEENTRY_WEIGHT) {

                this.priorAssessmentAnswer = apAssessmentDto.priorAnswerList[0]?.answerText.baseText
                    + ' ' + apAssessmentDto.question.responseUOM[0].uom;

            } else if (this.questionType === QUESTION_TYPE.VALUEENTRY_DATE) {

                this.priorAssessmentAnswer = apAssessmentDto.priorAnswerList[0]?.answerText.baseText;

            } else {

                this.priorAssessmentAnswer = apAssessmentDto.priorAnswerList;
            }
        }
    }

    public alignCalendar(align: boolean) {

        if (align) {
            this.setMargin = '240px';
        } else {
            this.setMargin = '10px';
        }
    }

    public showHelpInformation(helpText: string) {

        helpText = helpText.replace(/(?:\r\n|\r|\n)/g, '<br />');

        this.showHelpText = helpText;
        this.showHelpDialog = true;
    }

    private setLabels() {

        this.hasBeenSavedLabel              = 'has been saved.';
        this.hasBeenCompletedLabel          = 'has been completed.';
        this.loadingLabel                   = 'Loading';
        this.noMemberIdMsgLabel             = 'Did not receive member id to start the assessment.';
        this.noAlgorithmIdMsgLabel          = 'Did not receive assessment algorithm id to start the assessment.';
        this.noUrlLabel                     = 'Web service url endpoint is required.';

        this.questionIsRequiredMsgLabel     = 'This question is required. Please supply an answer and select Next to continue.';
        this.questionIsRequiredTitleLabel   = 'Required Question';

        this.valueForLabel                  = 'The value for';
        this.valueForAndLabel               = 'and the value for';
        this.mustBeBetweenLabel             = 'must be between';
        this.pregnancyDueDateLabel          = 'Please enter a pregnancy due date less than one month in the past and no greater than ten months in the future.';
        this.provideDateLabel               = 'Please provide a valid date.';
        this.previousLabel                  = 'Previous';
        this.nextLabel                      = 'Next';

        this.helpDialogTitleLabel           = 'Help Text';
        this.dontKnowLabel                  = 'Don\'t know';
        this.declineLabel                   = 'Declined or did not provide answer';
        this.decimalsLabel                  = 'Decimals are not saved, enter whole numbers only';
        this.minmaxLabel                    = 'Min/Max';
        this.theLabel                       = 'The';
        this.readOnlyLabel                  = 'Read Only'; 

        if (this.isNotEmpty(this.language) && (this.language.toLowerCase() === 'spa' || this.language.toLowerCase() === 'spanish')) {

            this.helpDialogTitleLabel = 'Texto de Ayuda';
            this.minmaxLabel = 'Mínimo/Máximo';
            this.dontKnowLabel = 'No sé';
            this.declineLabel = 'Rechazar';
            this.previousLabel =  'Anterior';
            this.nextLabel =  'Siguiente';
            this.provideDateLabel = 'Proporcione una fecha válida.';
            this.valueForLabel = 'El valor de';
            this.valueForAndLabel = 'y el valor de';
            this.mustBeBetweenLabel = 'debe estar entre';            
            this.questionIsRequiredMsgLabel = 'Esta pregunta es obligatoria. Responda y seleccione Siguiente para continuar.';
            this.questionIsRequiredTitleLabel = 'Pregunta requerida';
            this.hasBeenSavedLabel = 'se guardó.';
            this.hasBeenCompletedLabel = 'se completó.';
            this.loadingLabel = 'Cargando';
            this.pregnancyDueDateLabel = 'Ingrese una fecha final del embarazo (fecha de parto) de menos de un mes en el pasado y no mayor de diez meses en el futuro.';
            this.decimalsLabel = 'Los decimales no se guardan, ingrese solo números enteros';
            this.theLabel = 'El';
            this.readOnlyLabel = 'Solo lectura';
        }
    }

    public translateToSpanish(translate: string): string {
        
        if (this.isNotEmpty(this.language) && (this.language.toLowerCase() === 'spa' || this.language.toLowerCase() === 'spanish') && this.isNotEmpty(translate)) {

            if (translate.toLocaleLowerCase() === 'feet') {
                return 'pies';
            } else if (translate.toLocaleLowerCase() === 'inches') {
                return 'pulgadas';
            } else if (translate.toLocaleLowerCase() === 'pounds' || translate.toLocaleLowerCase() === 'lbs') {
                return 'libras';
            }
        }

        return translate;
    }

    public getFullYearRange(): string {

        let today = new Date();
        let year = today.getFullYear();
        return (year - 125) + ':' + (year + 10);
    }

    private handleError(message: string, error: any) {

        let err: AssessmentErrorDto = new AssessmentErrorDto();
        err.message = message;
        err.error = error;

        this.assessmentErrorOccurred.emit(err);
    }

    private log(message: string, data?: any) {

        if (isDevMode()) {

            if (data !== undefined) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
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

    public ngOnDestroy() {

        console.log('destroying assessment control for ' + this.memberId);

        if (this.firstQuestionSubscription !== null) {
            this.firstQuestionSubscription.unsubscribe();
        }

        if (this.navigateToNextSubscription !== null) {
            this.navigateToNextSubscription.unsubscribe();
        }

        if (this.navigateToPreviousSubscription !== null) {
            this.navigateToPreviousSubscription.unsubscribe();
        }

        if (this.startNewAssessmentSubscription !== null) {
            this.startNewAssessmentSubscription.unsubscribe();
        }

        if (this.continueAssessmentSubscription !== null) {
            this.continueAssessmentSubscription.unsubscribe();
        }

        if (this.beginContinueAssessmentSubscription !== null) {
            this.beginContinueAssessmentSubscription.unsubscribe();
        }
                       
        if (this.getInfoSubscription !== null) {
            this.getInfoSubscription.unsubscribe();
        }

        if (this.getCompletionDataSubscription !== null) {
            this.getCompletionDataSubscription.unsubscribe();
        }        
    }
}
