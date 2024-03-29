<?php
/**
 * @link http://www.yiiframework.com/
 * @copyright Copyright (c) 2008 Yii Software LLC
 * @license http://www.yiiframework.com/license/
 */

namespace yii\jui;

use yii\web\AssetBundle;

/**
 * @author Qiang Xue <qiang.xue@gmail.com>
 * @since 2.0
 */
class JuiAsset extends AssetBundle
{
    public $sourcePath = '@bower/jquery-ui';
    public $js = [
        //'jquery-ui.js',
        'jquery-ui.custom.js',
    ];
    public $css = [
        //'themes/start/jquery-ui.css',
        'themes/blue/jquery-ui.css',
    ];
    public $depends = [
        'yii\web\JqueryAsset',
    ];
}
