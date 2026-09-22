import { Component, OnInit, ViewChild } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subscription } from 'rxjs';
import { timer } from 'rxjs';
import { AssessmentCtrlComponent } from 'assessment-ctrl';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
    providers: [AssessmentCtrlComponent]
})
export class AppComponent implements OnInit {

    // inputs for the assessment control
    public useE24ProxyApi: boolean = false;
    public webserviceUrlBase: string = 'http://localhost:9991';
    private readonly initialWebserviceUrlBase: string = this.webserviceUrlBase;
    private manualWebserviceUrlBase: string = this.webserviceUrlBase;
    public e24UrlBase: string = 'https://aph-uat.expert-24.net';
	public memberId: string = 'ABC_TMJarrett';
	public language: string = 'eng';
    public e24TraversalId: string | null = null;
    public e24MemberId: string | null = null;
    public assessmentAlgorithmId: string = '10657';
	public assessmentCompletedLabel: string = 'Thank you for completing the assessment.';
    public showAssessmentCompletedLabel: boolean = true;
    public assessmentStartData: string = `{
    "DOB": "2010-01-06",
    "FallPrevRiskLevel": "No",
    "Gender": "Male",
    "FirstName": "Jarrett",
    "source_application": "AgentPortal"
}`;

    // non assessment control inputs
	public assessmentName: string = 'CareTrack Questionnaire (9045)';
	public showAssessment: boolean = false;
	public errorMessage: string | null = null;
	public assessmentOptions: SelectItem[] = [];
    public languageOptions: SelectItem[] = [];
    private timerSubscription: Subscription | null = null;
    public assessmentStartDataClean: string = '';
    public assessmentCompleteJson: string = '';
	public ngOnInit() {
	
        console.log('initializing assessment tester');

        this.defineAssessmentList();
        this.defineLanguageList();
		this.syncAssessmentName(this.assessmentAlgorithmId);
		this.syncWebserviceUrlBaseForMode();
	}

    public onUseE24ProxyApiChanged() {

        this.syncWebserviceUrlBaseForMode();
    }

    public onWebserviceUrlBaseChanged() {

        if (!this.useE24ProxyApi) {
            this.manualWebserviceUrlBase = this.webserviceUrlBase;
        }
    }

    public onE24UrlBaseChanged() {

        this.syncWebserviceUrlBaseForMode();
    }

    private syncWebserviceUrlBaseForMode() {

        if (this.useE24ProxyApi) {
            this.manualWebserviceUrlBase = this.webserviceUrlBase;
            this.webserviceUrlBase = this.e24UrlBase;
            return;
        }

        this.webserviceUrlBase = this.manualWebserviceUrlBase || this.initialWebserviceUrlBase;
    }

	public loadAssessment() {
        
        this.assessmentStartDataClean = this.assessmentStartData.replace(/[\n\r]/g, '');
        this.assessmentCompleteJson = '';
		this.showAssessment = true;
	}

    public reloadAssessment() {
        
        this.errorMessage = null;
		this.assessmentCompleteJson = '';
		this.showAssessment = false;

        let timerObs = timer(1000);

        if (this.timerSubscription !== null && this.timerSubscription !== undefined) {
            this.timerSubscription.unsubscribe();
        }

        this.timerSubscription = timerObs.subscribe(t => {
            this.showAssessment = true;
        });
	}

	private defineAssessmentList() {
        
        // Update this list as time progresses as the set of currently available assessments changes. 
        // The list is not automatically updated from the E24 API, so it must be manually maintained.
        
        this.assessmentOptions.push({ value: '10798', label: 'Check In With Us (10798)' });        
        this.assessmentOptions.push({ value: '10657', label: 'Healthy Aging Member Satisfaction Survey (10657)' });

        this.assessmentOptions.push({ value: '10583', label: '*Healthy Aging Assessment (10583)' });
        
		this.assessmentOptions.push({ value: '10591', label: 'Member Health Preference (10591)' });  
        
        this.assessmentOptions.push({ value: '9045', label: 'Care Manager Initial Assessment (9045)' });
        

        this.assessmentOptions.push({ value: '-----', label: '----------' });

        this.assessmentOptions.push({ value: '10672', label: 'UM Genetics (10672)' });
        this.assessmentOptions.push({ value: '10678', label: 'UM Endoscopy - Wrist (10678)' });
        this.assessmentOptions.push({ value: '10679', label: 'UM Endoscopy - Bronchoscopy (10679)' });
        this.assessmentOptions.push({ value: '10674', label: 'UM Endoscopy - Capsule Endoscopy (10674)' });
        this.assessmentOptions.push({ value: '10677', label: 'UM Cardiology (10677)' });
	}

    private defineLanguageList() {

		this.languageOptions.push({ value: 'eng', label: 'English' });
		this.languageOptions.push({ value: 'spa', label: 'Spanish' });
	}

    public setAssessmentName($event: any) {
        this.syncAssessmentName($event?.value);
        
        this.errorMessage = null;
		this.showAssessment = false;
    }

    private syncAssessmentName(assessmentAlgorithmId: string | null | undefined) {

        const selectedValue = assessmentAlgorithmId ?? this.assessmentAlgorithmId;
        const assessment: SelectItem | undefined = this.assessmentOptions.find(x => x.value === selectedValue);

        if (assessment !== null && assessment !== undefined) {
            this.assessmentName = assessment.label || '';
        }
    }

	public assessmentErrorOccurred($event: any) {
		
        const details: string[] = [];

        if ($event !== null && $event !== undefined && $event.error !== null && $event.error !== undefined) {
            details.push(typeof $event.error === 'string' ? $event.error : this.formatJson($event.error));
        }

        if ($event !== null && $event !== undefined && $event.message !== null && $event.message !== undefined) {
            details.push(String($event.message));
        }

        this.errorMessage = details.length > 0
            ? details.join(' | ')
            : (typeof $event === 'string' ? $event : this.formatJson($event));

        console.log('assessmentErrorOccurred: ', $event);
		console.error($event);
	}

	public assessmentIsComplete($event: any) {
		this.assessmentCompleteJson = this.formatJson($event);
		console.log('assessmentIsComplete: ', $event);
	}

    private formatJson(value: any): string {

        if (value === null || value === undefined) {
            return '';
        }

        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }

    public onDestroy() {
        
        if (this.timerSubscription !== null && this.timerSubscription !== undefined) {
            this.timerSubscription.unsubscribe();
        }
    }
}
