export enum QUESTION_TYPE {
    FREE_TEXT = 'FREE_TEXT',
    MULTIPLE_CHOICE_SINGLE_SELECT = 'MULTIPLE_CHOICE_SINGLE_SELECT',
    MULTIPLE_CHOICE_MULTIPLE_SELECT = 'MULTIPLE_CHOICE_MULTIPLE_SELECT',
    RECOMMENDATION_FINALIZATION = 'RECOMMENDATION_FINALIZATION',
    RECOMMENDATION_DEFAULT = 'RECOMMENDATION_DEFAULT',
    VALUEENTRY_DATE = 'VALUEENTRY_DATE',
    VALUEENTRY_HEIGHT = 'VALUEENTRY_HEIGHT',
    VALUEENTRY_WEIGHT = 'VALUEENTRY_WEIGHT'
}

export enum ASSESSMENT_STATUS {
    NOT_STARTED = 'NOT_STARTED',
    START = 'START',
    IN_PROGRESS = 'IN_PROGRESS',
    READY_TO_SUBMIT = 'READY_TO_SUBMIT',
    COMPLETE = 'COMPLETE'
}

export class AssessmentErrorDto {
    message: string;
    error: any;
}

export class AssessmentStartRequestDto {
    memberId: string;
    assessmentAlgorithmId: string;
    startDateAsString: string;
    actualAssessmentDateAsString: string;
}

export class AssessmentDto {
    assessmentStatus: string;
    question: QuestionDto;
    answerList: AnswerResponseDto[] = [];
    priorAnswerList: PriorAnswerResponseDto[] = [];
    e24MemberId: string;
    nodeId: number;
    algoId: number;
    traversalId: string;  
    textSubCategory: string;  
    finalizationNoticeList: ApFinalizationNoticeModel[] = [];
}

export class ApFinalizationNoticeModel {
    notice: string;
    isSkillsetRecommendation: boolean;
}

export class ApAssessmentPreviousAnswerDTO {
    memberId: string;
    algorithmId: string;
    questionId: string;
    lastAssessmentCompletionDateAsString: string;
    answerDesc: string;
    translatedAnswerDesc: string;
}

export class QuestionDto {
    questionText: LiteracyTextDto;
    isRequired: boolean;
    helpText: string;
    questionType: string;
    questionId: string;
    isFirstQuestion: boolean;
    isLastQuestion: boolean;
    hasDontKnowAnswer: boolean;
    hasDontKnowResponse: boolean;
    hasDeclineAnswer: boolean;
    hasDeclineResponse: boolean;
    isPregnancyDueDateQuestion: boolean;
    responseMeasureUnit: string;
    responseUOM: ResponseUOMDto[] = [];
    answerList: AnswerResponseDto[];
    infoId: number;
}

export class HelpTextDto {
    table: Table [];
}

export class Table {
    explanation: string;
}

export class ApResponseAsset {
    id: string;
    type: string;
    sub_type: string;
    ap_answers: ApAnswer[];
    ap_literacy: ApLiteracy;
    is_required: boolean;
    is_first_in_path: boolean;
    value: string;
    help_text: string;
    ap_categories: ApCategory[];
    name: string;
    is_non_visual: boolean;
    ap_measure_units: ApMeasureUnits[];
    ap_recommendations: ApRecommendation[];
    ap_references: ApReferences[];
    has_dont_know_answer: boolean;
    value_user_response_dont_know_answer: boolean;
    has_decline_answer: boolean;
    value_user_response_decline_answer: boolean;
    infoId: number;
}

export class ApAnswer {
    ap_literacy: ApLiteracy;
    id: string;
    answerId: number;
    type: string;
    sub_type: string;
    help_text: string;
    value_user_response: boolean;
    is_exclusive: boolean;
    infoId: number;
}

export class ApLiteracy {
    base: string;
    expert: string;
    lay: string;
    individualGoalSupport: string;
}

export class ApCategory {
    name: string;
    description: string;
    id: string;
    ap_categories: ApCategories[];
}

export class ApCategories {
    ap_categories: string;
    description: string;
    id: string;
    name: string;
}

export class ApMeasureUnits {
    id: string;
    ap_measure_unit_values: ApMeasureUnitValues[];
    name: string;
    value: string;
    value_maximum: number;
    value_minimum: number;
}

export class ApMeasureUnitValues {
    id: string;
    name: string;
    value_maximum: number;
    value_minimum: number;
    value: number;
    value_default: number;
}

export class ApRecommendation {
    ap_literacy: ApLiteracy;
    type: string;
    sub_type: string;
    name: string;
}

export class ApReferences {
    type: string;
    title: string;
}

export class ResponseUOMDto {
    id: string;
    uom: string;
    value: string;
    value_default: number;
    value_maximum: number;
    value_minimum: number;
}

export class AnswerResponseDto {
    answerText: LiteracyTextDto;
    helpText: string;
    answerId: string;
    userResponse: string;
    infoId: number;
}

export class ApAssessmentLiteracyModel {
    baseText: string;
    layText: string;
    expertText: string;
}

export class AnswerRequestDto {
    answerId: string | null;
    answerText: string | null;
}

export class PriorAnswerResponseDto {
    answerText: LiteracyTextDto;
    assessmentCompletedDate: string;
}

export class LiteracyTextDto {
    baseText: string;
    layText: string;
    expertText: string;
}

export class QuestionAnswerDto {
    questionText: string;
    answerText: string;
    answerUOM: string;
}

export class ApAnswerModel {
    answerText: ApAssessmentLiteracyModel;
    helpText: string;
    answerId: string;
    infoId: number;
    userResponse: string;
    isExclusive: boolean;
    isToBeBold: boolean = false;
}

export class ApPriorAnswerModel {
    answerText: ApAssessmentLiteracyModel;
    assessmentCompletedDate: string;
}

