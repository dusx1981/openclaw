## ADDED Requirements

### Requirement: Price anomaly detection
The system SHALL detect unusual price changes for monitored products.

#### Scenario: Detect significant price drop
- **WHEN** product price drops more than 20% from baseline
- **THEN** system triggers price drop alert
- **AND** sends notification via configured channels

#### Scenario: Detect competitor price undercut
- **WHEN** competitor price becomes lower than user's product price
- **THEN** system alerts user with price comparison
- **AND** suggests pricing strategy adjustment

### Requirement: Sales velocity monitoring
The system SHALL track sales velocity changes and detect anomalies.

#### Scenario: Detect sales spike
- **WHEN** daily sales increase more than 200% compared to 7-day average
- **THEN** system flags product as trending
- **AND** sends alert with sales trend visualization

#### Scenario: Detect sales decline
- **WHEN** daily sales drop more than 50% compared to 7-day average
- **THEN** system triggers decline alert
- **AND** suggests potential causes

### Requirement: Review sentiment monitoring
The system SHALL analyze product review sentiment and detect negative trends.

#### Scenario: Detect negative review spike
- **WHEN** negative review ratio increases more than 10% in 24 hours
- **THEN** system sends sentiment alert
- **AND** includes sample negative reviews

### Requirement: Notification delivery
The system SHALL deliver alerts through multiple notification channels.

#### Scenario: Send DingTalk notification
- **WHEN** alert condition is triggered
- **THEN** system sends message to configured DingTalk webhook
- **AND** includes alert summary with link to dashboard

#### Scenario: Send WeChat Work notification
- **WHEN** alert condition is triggered
- **THEN** system sends message to configured WeChat Work bot
- **AND** formats message for mobile readability