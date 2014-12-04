/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Structure of table `alerts`
--

CREATE TABLE IF NOT EXISTS `alerts` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID of alert',
  `facebook_app_id` bigint(20) NOT NULL COMMENT 'Facebook APP id',
  `facebook_user_id` bigint(20) DEFAULT NULL COMMENT 'Facebook user id',
  `lat` double NOT NULL COMMENT 'Latitude',
  `lng` double NOT NULL COMMENT 'Longtitude',
  `icon` enum('1','2','3','4','5') NOT NULL DEFAULT '1' COMMENT 'Icon type',
  `path` varchar(250) NOT NULL COMMENT 'Relative path to image',
  `note` varchar(250) DEFAULT NULL COMMENT 'Note of alert',
  `published` datetime NOT NULL COMMENT 'Published datetime',
  `expire_on` datetime NOT NULL COMMENT 'Expires on datetime',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1 ;
