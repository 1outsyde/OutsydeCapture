Pod::Spec.new do |s|
  s.name           = 'OutsydeWalletButton'
  s.version        = '1.0.0'
  s.summary        = "Apple's Add to Apple Wallet button (PKAddPassButton) for the ticket screen"
  s.description    = "A native view wrapping PassKit's PKAddPassButton. A tap is sent to JS as onPress."
  s.author         = 'Outsyde'
  s.homepage       = 'https://goutsyde.com'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.frameworks     = 'PassKit'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
