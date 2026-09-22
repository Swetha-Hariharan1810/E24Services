
export class E24StartDto {
    '@UserID': string;
    callback: string;
    Prepop?: string;
}

export class E24StartResponseDto {
    ReturnValue: string;
    DOB: string;
    Gender: string;
    Self: string;
    XmlTime: string;
    NLTime: string;
    TotalTime: string;
    Table: E24StartTableDto[];
    JsonTime: number;
}

export class E24StartTableDto {
    MemberID: string;
    TraversalID: string;
    MMSIID: string;
    FirstName: string;
    Surname: string;
    DOB: string;
    Gender: string;
    Language: string;
    UserType: string;
    DaysAlive: string;
}

export class E24QuestionResponseDto {
    Age: number;
    AlgoID: number;
    AlgoName: string;
    Assessment: number;
    Questions: E24QuestionDto[];
    Conclusions: any;
    Counter: number;
    DaysAlive: number;
    Error: string;
    Gender: string;
    HRAReport: boolean;
    Language: string;
    NodeID: number;
    Report: any;
    Self: boolean;
    Timings?: any;
    UserType: number;
    suppressBack: boolean;
    suppressNext: boolean;
}

export class E24QuestionDto {
    AllowComments: boolean;
    Answers: E24QuestionAnswer[];
    Comment: string;
    Comments: number;
    Display: string;
    DisplayText: string;
    Error: string;
    Flow: string;
    ImageAreas: string;
    ImageMapID: string;
    ImageSource: string;
    Properties: E24Property;
    QuestionID: number;
    Questions: any;
    Rows: any;
    Title: string;
    hasInfo: boolean;
}

export class E24InfoHelpTextResponseDto {
    ReturnValue: string;
    DOB: string;
    Gender: string;
    Self: string;
    UserType: string;
    XmlTime: string;
    NLTime: string;
    TotalTime: string;
    Table: E24InfoHelpTextDto[];
    JsonTime: number;
}

export class E24InfoHelpTextDto {
    Explanation: string;
}




export class E24WorkboxResponse {
    id: string;
    ap_algorithm_id: string;
    ap_assets: E24Asset[];
    percent_complete: string;
    status: string;
    e24MemberId: string;
    nodeId: number;
    algoId: number;
    infoId: number;
    traversalId: string;
}

export class E24Asset {
    id: string;
    type: string;
    sub_type: string;
    ap_answers: E24Answer[];
    ap_literacy: E24Literacy;
    is_required: boolean;
    is_first_in_path: boolean;
    value: string;
    help_text: string;
    ap_categories: E24Category[];
    name: string;
    is_non_visual: boolean;
    ap_measure_units: E24MeasureUnit[];
    ap_recommendations: E24Recommendation[];
    ap_references: E24Reference[];
    has_dont_know_answer: boolean;
    value_user_response_dont_know_answer: boolean;
    has_decline_answer: boolean;
    value_user_response_decline_answer: boolean;
    infoId: number;
}

export class E24Answer {
    ap_literacy: E24Literacy;
    id: string;
    answerId: number;
    type: string;
    sub_type: string;
    help_text: string;
    value_user_response: boolean;
    is_exclusive: boolean;
    infoId: number;
}

export class E24QuestionAnswer {
    Properties: E24Property;
    Disabled: boolean;
    QuestionID: number;
    AnswerID: number;
    ControlType: string;
    ControlSubType: string;
    ControlName: string;
    ControlFormName: string;
    ControlID: string;
    ControlValue: string;
    DisplayText: string;
    Comment: string;
    Error: string;
    hasInfo: boolean;
    Index: string;
    isChecked: boolean;
    isHidden: boolean;
}

export class E24Reference {
    type: string;
    title: string;
}

export class E24Recommendation {
    ap_literacy: E24Literacy;
    type: string;
    sub_type: string;
    name: string;
}

export class E24MeasureUnit {
    id: string;
    ap_measure_unit_values: E24MeasureUnitValue[];
    name: string;
    value: string;
    value_maximum: number;
    value_minimum: number;
}

export class E24MeasureUnitValue {
    id: string;
    name: string;
    value_maximum: number;
    value_minimum: number;
    value: number;
    value_default: number;
}

export class E24Category {
    name: string;
    description: string;
    id: string;
    ap_categories: E24Categories[];
}

export class E24Categories {
    ap_categories: string;
    description: string;
    id: string;
    name: string;
}

export class E24Literacy {
    base: string;
    expert: string;
    lay: string;
    individualGoalSupport: string;
}

export class E24Property {
    referenceType: string;
    source: string;
    highLiteracyRecommendation: string;
    individualGoalSupport: string;
    lowLiteracyRecommendation: string;
    baseText: string;
    CategoryProperties: E24CategoryProperty[];
    guid: string;
    Priority: string;
    educationGuid: string;
    educationReferenceType: string;
    educationSource: string;
    educationTitle: string;
    instructionContent: string;
    instructionGuid: string;
    instructionTitle: string;
}

export class E24CategoryProperty {
    Name: string;
    Categories: Category[];
}

export class Category {
    Name: string;
    Categories: Category[];
}

export class AssessmentFinalDto {
    AssessmentName: string;
    TraversalID: string;
    AlgorithmID: string;
    ContentVersion: string;
    HRAstatus: string;
    CarePlanGroupId?: string;
    CarePlanGroupName?: string;
    Questions: AnsweredQuestionDto[] = [];
    ReportInformationConclusions: Conclusion[] = [];
    AlertConclusions: Conclusion[] = [];
    CarePlanConclusions: Conclusion[] = [];
    DefaultConclusions: Conclusion[] = [];
}

export class CarePlanGroupDto {
    CarePlanGroupId: string;
    CarePlanGroupName: string;
}

export class AnsweredQuestionDto {
    NodeID: string;
    QuestionID: string;
    Question: string;
    AnsID: string;
    Answer: string;
    SValue: string;  // free text question answer
}

export class RecommendationDto {
    ConclusionID: string;
    RecommendationType: string;
    RecommendationText: string;
}

export class Conclusions {
    conclusions: Conclusion[] = [];
}

export class Conclusion {
    Properties: Properties;
    Bullets: Bullet[] = [];
    Category?: string;
    ConclusionID: number;
    DisplayText: string;
    ExpertText: string;
    Explanation: string;
    More_Detail: string;
    Title: string;
    Truncated: string;
    SubCat1?: string;
    SubCat2?: string;
    isReason: boolean;
    isSilent?: boolean;
}

export class Bullet {
    BulletID: number;
    Category: string;
    ConclusionID: number;
    DisplayText: string;
    Properties: Properties;
}

export class Properties {
    CategoryProperties: CategoryProperty[] = [];
    baseText?: string;
    instructionContent?: string;
    instructionTitle?: string;
    educationReferenceType?: string;
    educationSource?: string;
    educationTitle?: string;
    leadingIndicator?: string;
    highLiteracyRecommendation?: string;
    lowLiteracyRecommendation?: string;
}

export class CategoryProperty {
    Categories: Category[] = [];
    Name: string;
}

export class E24MemberIdTraversalIdDto {
    public E24MemberId: string;
    public E24TraversalId: string;    
}
